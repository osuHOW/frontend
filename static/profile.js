// code that is executed on every user profile
$(document).ready(function() {
	var wl = window.location;
	var newPathName = wl.pathname;
	// userID is defined in profile.html
	if (newPathName.split("/")[2] != userID) {
		newPathName = "/u/" + userID;
	}
	// if there's no mode parameter in the querystring, add it
	let newSearch = wl.search;

	if (wl.search.indexOf("mode=") === -1) {
		newSearch = "?mode=" + favouriteMode;
	}

	if (wl.search.indexOf("rx=") === -1)
		newSearch += "&rx=" + preferRelax;

	if (wl.search != newSearch)
		window.history.replaceState('', document.title, newPathName + newSearch + wl.hash);
	else if (wl.pathname != newPathName)
		window.history.replaceState('', document.title, newPathName + wl.search + wl.hash);
	setDefaultScoreTable();

	$("#rx-menu>.item").click(function(e) {
		e.preventDefault();
		if ($(this).hasClass("active"))
			return;

		preferRelax = $(this).data("rx");
		$("[data-mode]:not(.item):not([hidden])").attr("hidden", "");
		$("[data-mode=" + favouriteMode + "][data-rx=" + preferRelax + "]:not(.item)").removeAttr("hidden");
		$("#rx-menu>.active.item").removeClass("active");
		var needsLoad = $("#scores-zone>[data-mode=" + favouriteMode + "][data-loaded=0][data-rx=" + preferRelax + "]");
		if (needsLoad.length > 0)
			initialiseScores(needsLoad, favouriteMode);
		$(this).addClass("active");
		window.history.replaceState('', document.title, `${wl.pathname}?mode=${favouriteMode}&rx=${preferRelax}${wl.hash}`)
	});


	// when an item in the mode menu is clicked, it means we should change the mode.
	$("#mode-menu>.item").click(function(e) {
		e.preventDefault();
		if ($(this).hasClass("active"))
			return;
		var m = $(this).data("mode");
		favouriteMode = m;
		$("[data-mode]:not(.item):not([hidden])").attr("hidden", "");
		$("[data-mode=" + m + "][data-rx=" + preferRelax + "]:not(.item)").removeAttr("hidden");
		$("#mode-menu>.active.item").removeClass("active");
		var needsLoad = $("#scores-zone>[data-mode=" + m + "][data-loaded=0][data-rx=" + preferRelax + "]");
		if (needsLoad.length > 0)
			initialiseScores(needsLoad, m);
		$(this).addClass("active");
		window.history.replaceState('', document.title, `${wl.pathname}?mode=${m}&rx=${preferRelax}${wl.hash}`);
	});
	initialisePinnedAchievements();
	initialiseAchievements();
	initialiseFriends();
	var mostPlayedButtonContainer = $("#most-played-button-container");
	mostPlayedButtonContainer.append($("<button class=\"solid-button profile-load-more-button\" id=\"load-more-most-played\">placeholder load more button!</button>").click(loadMoreMostPlayed))
	loadMostPlayedBeatmaps();
	var favouriteBeatmapsButtonContainer = $("#favourite-beatmaps-button-container");
	favouriteBeatmapsButtonContainer.append($("<button class=\"solid-button profile-load-more-button\" id=\"load-more-favourites\">placeholder load more button!</button>").click(loadMoreFavourites))
	loadFavouriteBeatmaps();
	// load scores page for the current favourite mode
	var i = function(){initialiseScores($("#scores-zone>div[data-mode=" + favouriteMode + "][data-rx=" + preferRelax + "]"), favouriteMode)};
	if (i18nLoaded)
		i();
	else
		i18next.on("loaded", function() {
			i();
		});
	loadOnlineStatus();
	setInterval(loadOnlineStatus, 10000);
	// graphs
	api("users/get_activity", {
        mode: favouriteMode,
		rx: preferRelax,
        userid: userID,
    }, function (r) {
        //Loading Graps!
        var dataFormatted = convert_to_normal_format(r.ppGraph.data)
        loadGraph(favouriteMode, dataFormatted, r.ppGraph.minLimit, r.ppGraph.maxLimit)
		return;
	});
});
function initialisePinnedAchievements() {
	api('users/achievements/pinned',
		{id: userID}, function (resp) {
		var achievements = resp.achievements;
		if (achievements.length === 0) {
			return;
		}

		var displayAchievements = function(limit, achievedOnly) {
			var $base = $("#pinned-medals-container").empty();
			// create a container for the pinned medals
			$base.append("<div class=\"profile-pinned-medal-text-container\"> pinned medals <img src=\"/static/icons/pinned-medal.svg\" class=\"profile-pinned-medal-icon\"/> </div> <div id=\"pinned-medals\" class=\"profile-pinned-medal-medal-container\"></div>")
			var $ach = $("#pinned-medals").empty();
			limit = 5
			var shown = 0;
			
			for (var i = 0; i < achievements.length; i++) {
				var ach = achievements[i];
				if (shown >= limit || (achievedOnly && !ach.achieved)) {
					continue;
				}
				shown++;
				
				$ach.append(
					$("<i class='profile-pinned-medal-medal-icon' style=\"--pinned-medal-icon: url('https://s.osuhow.cf/images/medals-" + "client/" + ach.icon + ".png')\"" + "/>").popup({
						title: ach.name,
						content: ach.description,
						position: "bottom center",
						distanceAway: 10
					})
				);
			}
			// if we've shown nothing, and achievedOnly is enabled, try again
			// this time disabling it.
			if (shown == 0 && achievedOnly) {
				displayAchievements(limit, false);
			}
		};

		// only 8 achievements - we can remove the button completely, because
		// it won't be used (no more achievements).
		// otherwise, we simply remove the disabled class and add the click handler
		// to activate it.
		if (achievements.length <= 8) {
			$("#load-more-achievements").remove();
		} else {
			$("#load-more-achievements")
				.removeClass("disabled")
				.click(function() {
				$(this).remove();
				displayAchievements(-1, false);
			});
		}
		displayAchievements(8, true);
	});
}
function formatOnlineStatusBeatmap(a) {
	var hasLink = a.beatmap.id > 0;
	return "<i>" + (hasLink ? "<a href='/b/" + escapeHTML(a.beatmap.id) + "'>" : "") + escapeHTML(a.text) + (hasLink ? '</a>' : '' ) + "</i>";
}

function loadOnlineStatus() {
	// load in-game status through delta api
	banchoAPI('clients/' + userID, {}, function(resp) {

		var client = null;
		resp.clients.forEach(function (el) {
			if (el.type === 0 || client === null) {
				client = el
			}
		});
		if (client !== null) {
			var icon;
			var text;
			switch (client.type) {
				case 1: {
					// irc
					icon = 'blue comment';
					text = 'Online through IRC';
				}; break;
				case 0: {
					// bancho
					switch (client.action.id) {
						case 1: {
							icon = 'bed';
							text = 'AFK';
						}; break
						case 2: {
							icon = 'teal play circle';
							text = "Playing " + formatOnlineStatusBeatmap(client.action);
						}; break
						case 3: {
							icon = 'orange paint brush';
							text = "Editing " + formatOnlineStatusBeatmap(client.action);
						}; break;
						case 4: {
							icon = 'violet paint brush';
							text = "Modding " + formatOnlineStatusBeatmap(client.action);
						}; break;
						case 5: {
							icon = 'olive gamepad';
							text = "In Multiplayer Match";
						}; break;
						case 12: {
							icon = 'green play circle';
							text = "Multiplaying " + formatOnlineStatusBeatmap(client.action);
						}; break;
						case 11: {
							icon = 'orange map signs';
							text = "In Multiplayer Lobby";
						}; break;
						case 6: {
							icon = 'pink eye';
							text = "Spectating " + formatOnlineStatusBeatmap(client.action);
						}; break;
						default: {
							icon = 'green circle';
							text = 'Online';
						};
					}
				}; break;
				case 2: {
					// ws
					icon = 'green cogs';
					text = 'Online';
				}; break
			}
		} else {
			// offline
			icon = 'circle';
			text = 'Offline'
		}
		$('#online>.icon').attr('class', icon + ' icon');
		$('#online>span').html(text);
	});
}

function get_range(date) {
    let d = new Date(date);
    let current = new Date();
    if (d == undefined) { return null; }
    return Math.ceil(Math.abs(current.getTime() - d.getTime()) / (1000 * 3600 * 24));
}


function convert_to_normal_format(data) {
    minDay = 0
    newdata = {}
    sonewerdata = []
    if (data == undefined || data == null) {
        return []
    }
    data = data.slice(data.length-60, data.length)
    data.forEach(element => {
        var s = get_range(element['day']); 
        if (s>minDay) { minDay = s };
        newdata[-s] = element['value'] });
    
    last_knowed_info = 0
    for(var x = -minDay; x<0; x++) {
        if (newdata[x] == undefined) { sonewerdata.push([x+1, last_knowed_info]); continue; }
        last_knowed_info = newdata[x];
        sonewerdata.push([x+1, newdata[x]]);
    }

    //sonewerdata = sonewerdata.slice(sonewerdata.length-60, sonewerdata.length)

    return sonewerdata
}

function con_data(data) {	
    return [
        {
            area: false,
            values: data,
            key: "Performance",
            color: "#c02a70",
            size: 6
        },
    ];
}

function loadGraph(mode, cdata, minPP, maxPP) {
    var chart;

    nv.addGraph(function() {
        chart = nv.models.lineChart()
        .options({
            margin: {left: 80, bottom: 45},
            x: function(d) { return d[0] },
            y: function(d) { return d[1] },
            showXAxis: true,
            showYAxis: true
        })
        ;

        chart.xAxis
        .axisLabel("Days")
        .tickFormat(function(d) {
            if (d == 0) return "now";
	  	    return -d + " days ago";
        });

        chart.yAxis
        .axisLabel('Performance')
        .tickFormat(function(d) {
            if (d == 0) return "-";
            return d +"pp";
        })
        ;

        chart.yScale(d3.scale.log().clamp(true));

        chart.forceY([minPP,maxPP]);
        chart.yAxis.tickValues(-maxPP);

        chart.xAxis.tickValues([-31, -15, 0]);
        chart.forceX([-31,0]);

        // No disabling / enabling elements allowed.
        chart.legend.updateState(false);
        chart.interpolate("basis");

        var svg = d3.select('#graph1 div[data-mode="' + mode + '"] svg');

        svg.datum(con_data(cdata))
        .call(chart);
    })
}



function initialiseAchievements() {
	api('users/achievements' + (currentUserID == userID ? '?all' : ''),
		{id: userID}, function (resp) {
		var achievements = resp.achievements;
		// no achievements -- show default message
		if (achievements.length === 0) {
			$("#achievements")
				.append($("<div class='ui sixteen wide column'>")
					.text(T("Nothing here. Yet.")));
			$("#load-more-achievements").remove();
			return;
		}

		var displayAchievements = function(limit, achievedOnly) {
			var $ach = $("#achievements").empty();
			limit = limit < 0 ? achievements.length : limit;
			var shown = 0;
			for (var i = 0; i < achievements.length; i++) {
				var ach = achievements[i];
				if (shown >= limit || (achievedOnly && !ach.achieved)) {
					continue;
				}
				shown++;
				$ach.append(
					$("<div class='ui two wide column'>").append(
						$("<img src='https://s.osuhow.cf/images/medals-" +
							"client/" + ach.icon + ".png' alt='" + ach.name +
							"' class='" +
							(!ach.achieved ? "locked-achievement" : "achievement") +
							"'>").popup({
							title: ach.name,
							content: ach.description,
							position: "bottom center",
							distanceAway: 10
						})
					)
				);
			}
			// if we've shown nothing, and achievedOnly is enabled, try again
			// this time disabling it.
			if (shown == 0 && achievedOnly) {
				displayAchievements(limit, false);
			}
		};

		// only 8 achievements - we can remove the button completely, because
		// it won't be used (no more achievements).
		// otherwise, we simply remove the disabled class and add the click handler
		// to activate it.
		if (achievements.length <= 8) {
			$("#load-more-achievements").remove();
		} else {
			$("#load-more-achievements")
				.removeClass("disabled")
				.click(function() {
				$(this).remove();
				displayAchievements(-1, false);
			});
		}
		displayAchievements(8, true);
	});
}


function loadMostPlayedBeatmaps() {
	var mode = 0
	var mostPlayedTable = $("#most-played");
	currentPage[mode].mostPlayed++
	api('users/most_played', {id: userID, mode: mode, p: currentPage[mode].mostPlayed, l: 20}, function (resp) {
		if (resp.beatmaps === null) {
			return;
		}
		resp.beatmaps.forEach(function(el, idx) {
			mostPlayedTable.append(
				$("<div class=\"beatmap-info-panel-slim-main-container\" style=\"--beatmap-background: url('https://assets.ppy.sh/beatmaps/" + el.beatmapset_id + "/covers/cover.jpg');\"> \
									<div class=\"beatmap-info-panel-slim-glass-container\"> \
										<div class=\"beatmap-info-panel-slim-playtime-container\"> \
											<i class=\"fa-solid fa-play beatmap-info-panel-slim-playtime-icon\"></i> \
											<div class=\"beatmap-info-panel-slim-playtime-text\">" + el.playcount + "</div> \
										</div> \
										<div class=\"beatmap-info-panel-slim-info-background\"> \
											<div class=\"beatmap-info-panel-slim-info-container\"> \
												<div class=\"beatmap-info-panel-slim-text-container\"> \
													<div class=\"beatmap-info-panel-slim-text-lg\"> \
														" + el.artist + " - <b>" + el.title + "</b> \
													</div> \
													<div class=\"beatmap-info-panel-slim-text-sm\"> \
															mapped by <b>" + el.creator + "</b> \
													</div> \
												</div> \
											</div> \
										</div> \
									</div> \
								</div>")
			);
		}
		)
		if (resp.beatmaps.length >= 7) {
			$("#load-more-most-played").removeClass('disabled');
		}
		
								
	})
}

function loadFavouriteBeatmaps() {
	var mode = 0
	var favouritesTable = $("#favourites");
	currentPage[mode].favourites++
	api('users/favourites', {id: userID, mode: mode, p: currentPage[mode].favourites, l: 20}, function (resp) {
		if (resp.beatmaps === null) {
			return;
		}
		resp.beatmaps.forEach(function(el, idx) {
			favouritesTable.append(
				$("<div class=\"beatmap-info-panel-slim-main-container\" style=\"--beatmap-background: url('https://assets.ppy.sh/beatmaps/" + el.beatmapset_id + "/covers/cover.jpg');\"> \
									<div class=\"beatmap-info-panel-slim-glass-container\"> \
										<div class=\"beatmap-info-panel-slim-info-background\"> \
											<div class=\"beatmap-info-panel-slim-info-container\"> \
												<div class=\"beatmap-info-panel-slim-text-container\"> \
													<div class=\"beatmap-info-panel-slim-text-lg\"> \
														" + el.artist + " - <b>" + el.title + "</b> \
													</div> \
													<div class=\"beatmap-info-panel-slim-text-sm\"> \
															mapped by <b>" + el.creator + "</b> \
													</div> \
												</div> \
											</div> \
										</div> \
									</div> \
								</div>")
			);
		}
		)
		
		if (resp.beatmaps.length >= 7) {
			$("#load-more-favourites").removeClass('disabled');
		}
								
	})
}


function initialiseFriends() {
	var b = $("#add-friend-button");
	if (b.length == 0) return;
	api('friends/with', {id: userID}, setFriendOnResponse);
	b.click(friendClick);
}
function setFriendOnResponse(r) {
	var x = 0;
	if (r.friend) x++;
	if (r.mutual) x++;
	setFriend(x);
}
function setFriend(i) {
	var b = $("#add-friend-button");
	b.removeClass("loading green blue red");
	switch (i) {
	case 0:
		b
			.addClass("blue")
			.attr("title", T("Add friend"))
			.html("<i class='plus icon'></i>");
		break;
	case 1:
		b
			.addClass("green")
			.attr("title", T("Remove friend"))
			.html("<i class='minus icon'></i>");
		break;
	case 2:
		b
			.addClass("red")
			.attr("title", T("Unmutual friend"))
			.html("<i class='heart icon'></i>");
		break;
	}
	b.attr("data-friends", i > 0 ? 1 : 0)
}
function friendClick() {
	var t = $(this);
	if (t.hasClass("loading")) return;
	t.addClass("loading");
	api("friends/" + (t.attr("data-friends") == 1 ? "del" : "add"), {user: userID}, setFriendOnResponse, true);
}

var defaultScoreTable;
function setDefaultScoreTable() {
	defaultScoreTable = $("<table class='ui table score-table' />")
		.append(
			$("<thead />").append(
				$("<tr />").append(
					$("<th>" + T("General info") + "</th>"),
					$("<th>"+ T("Score") + "</th>")
				)
			)
		)
		.append(
			$("<tbody />")
		)
		.append(
			$("<tfoot />").append(
				$("<tr />").append(
					$("<th colspan=2 />").append(
						$("<div class='ui right floated pagination menu' />").append(
							$("<a class='disabled item load-more-button'>" + T("Load more") + "</a>").click(loadMoreClick)
						)
					)
				)
			)
		)
	;
}
i18next.on('loaded', function(loaded) {
	setDefaultScoreTable();
});

function initialiseScores(el, mode) {
	el.attr("data-loaded", "1");
	var pinned = defaultScoreTable.clone(true).addClass("orange");
	var best = defaultScoreTable.clone(true).addClass("orange");
	var recent = defaultScoreTable.clone(true).addClass("blue");
	var mostPlayedBeatmapsTable = $("<table class='ui table F-table yellow' data-mode='" + mode + "' />")
			.append(
					$("<thead />").append(
							$("<tr />").append(
									$("<th>"+ T("Beatmap") + "</th>"),
									$("<th class='right aligned'>"+ T("Plays") + "</th>")
							)
					)
			)
			.append(
					$('<tbody />')
			)
			.append(
					$("<tfoot />").append(
							$("<tr />").append(
									$("<th colspan=2 />").append(
											$("<div class='ui right floated pagination menu' />").append(
													$("<a class='load-more disabled item'>" + T("Load more") + "</a>").click(loadMoreMostPlayed)
											)
									)
							)
					)
			)
	best.attr("data-type", "best");
	recent.attr("data-type", "recent");
	mostPlayedBeatmapsTable.attr("data-type", "most-played");
	recent.addClass("no bottom margin");
	el.append($("<div class='ui segments no bottom margin' />").append(
		$("<div class='ui segment' />").append("<h2 class='ui header'>	" + T("Best scores") + "</h2>", best),
		$("<div class='ui segment' />").append("<h2 class='ui header'>" + T("Most played beatmaps") + "</h2>", mostPlayedBeatmapsTable),
		$("<div class='ui segment' />").append("<h2 class='ui header'>" + T("Recent scores") + "</h2>", recent)
	));
	loadScoresPage("best", mode);
	loadScoresPage("recent", mode);
	loadMostPlayedBeatmaps(mode);
};
function loadMoreClick() {
	var t = $(this);
	if (t.hasClass("disabled"))
		return;
	t.addClass("disabled");
	var type = t.parents("table[data-type]").data("type");
	var mode = t.parents("div[data-mode]").data("mode");
	loadScoresPage(type, mode);
}
function loadMoreMostPlayed() {
	var t = $(this);
	if (t.hasClass("disabled"))
		return;
	t.addClass("disabled");
	var mode = t.parents("div[data-mode]").data("mode");
	loadMostPlayedBeatmaps(mode);
}
function loadMoreFavourites() {
	var t = $(this);
	if (t.hasClass("disabled"))
		return;
	t.addClass("disabled");
	var mode = t.parents("div[data-mode]").data("mode");
	loadFavouriteBeatmaps(mode);
}
// currentPage for each mode
var currentPage = {
	0: {best: 0, recent: 0, mostPlayed: 0, favourites: 0},
	1: {best: 0, recent: 0, mostPlayed: 0, favourites: 0},
	2: {best: 0, recent: 0, mostPlayed: 0, favourites: 0},
	3: {best: 0, recent: 0, mostPlayed: 0, favourites: 0},
};

var rPage = {
	0: {best: 0, recent: 0/*, first: 0*/},
	1: {best: 0, recent: 0/*, first: 0*/},
	2: {best: 0, recent: 0/*, first: 0*/},
	3: {best: 0, recent: 0/*, first: 0*/}
};
var scoreStore = {};
function loadScoresPage(type, mode) {
	var table = $("#scores-zone div[data-mode=" + mode + "][data-rx=" + preferRelax + "] table[data-type=" + type + "] tbody");

	var page;
	if (preferRelax) page = ++rPage[mode][type];
	else page = ++currentPage[mode][type];
	console.log("loadScoresPage with", {
		page: page,
		type: type,
		mode: mode,
		rx: preferRelax,
	});
	var limit = type === 'best' ? 10 : 5;
	api("users/scores/" + type, {
		mode: mode,
		p: page,
		l: limit,
		rx: preferRelax,
		id: userID,
	}, function(r) {
		if (r.scores == null) {
			disableLoadMoreButton(type, mode);
			return;
		}
		r.scores.forEach(function(v, idx){
			scoreStore[v.id] = v;
			var scoreRank = getRank(mode, v.mods, v.accuracy, v.count_300, v.count_100, v.count_50, v.count_miss);
			var scoreRankIcon = "<img src='/static/ranking-icons/" + scoreRank + ".svg' class='score rank' alt='" + scoreRank + "'> ";
			var rowColor = '';

			if (type === 'recent') {
				rowColor = v.completed === 3 ? 'positive' : v.completed < 2 ? 'error' : '';
			}
			table.append($("<tr class='new score-row " + rowColor + "' data-scoreid='" + v.id + "' style='background: linear-gradient(90deg,#212121,#00000087,#212121), url(https://i0.wp.com/assets.ppy.sh/beatmaps/"+ v.beatmap.beatmapset_id +"/covers/cover.jpg) no-repeat right !important; background-size: cover !important;' />").append(
				$(
					"<td>" + (v.completed < 2 ? '' : scoreRankIcon) +
					escapeHTML(v.beatmap.song_name) + " <b>" + getScoreMods(v.mods) + "</b> <i>(" + v.accuracy.toFixed(2) + "%)</i><br />" +
					"<div class='subtitle'><time class='new timeago' datetime='" + v.time + "'>" + v.time + "</time></div></td>"
				),
				$("<td><b>" + ppOrScore(v.pp, v.score) + "</b> " + weightedPP(type, page, idx, v.pp) +	(v.completed == 3 ? "<br>" + downloadStar(v.id) : "") +	"</td>")
			));

		});
		$(".new.timeago").timeago().removeClass("new");
		$(".new.score-row").click(viewScoreInfo).removeClass("new");
		$(".new.downloadstar").click(function(e) {
			e.stopPropagation();
		}).removeClass("new");
		var enable = true;
		if (r.scores.length !== limit)
			enable = false;
		disableLoadMoreButton(type, mode, enable);
	});
}
function downloadStar(id) {
	return "<a href='/web/replays/" + id + "' class='new downloadstar'><i class='star icon'></i>" + T("Download") + "</a>";
}
function weightedPP(type, page, idx, pp) {
	if (type != "best" || pp == 0)
		return "";
	var perc = Math.pow(0.95, ((page - 1) * 20) + idx);
	var wpp = pp * perc;
	return "<i title='Weighted PP, " + Math.round(perc*100) + "%'>(" + wpp.toFixed(2) + "pp)</i>";
}
function disableLoadMoreButton(type, mode, enable) {
	var button = $("#scores-zone div[data-mode=" + mode + "][data-rx=" + preferRelax + "] table[data-type=" + type + "] .load-more-button");
	if (enable) button.removeClass("disabled");
	else button.addClass("disabled");
}
function viewScoreInfo() {
	var scoreid = $(this).data("scoreid");
	if (!scoreid && scoreid !== 0) return;
	var s = scoreStore[scoreid];
	if (s === undefined) return;

	// data to be displayed in the table.
	var data = {
		"Points":			 addCommas(s.score),
		"PP":					 addCommas(s.pp),
		"Beatmap":			"<a href='/b/" + s.beatmap.beatmap_id + "'>" + escapeHTML(s.beatmap.song_name) + "</a>",
		"Accuracy":		 s.accuracy + "%",
		"Max combo":		addCommas(s.max_combo) + "/" + addCommas(s.beatmap.max_combo)
											+ (s.full_combo ? " " + T("(full combo)") : ""),
		"Difficulty":	 T("{{ stars }} star", {
			stars: s.beatmap.difficulty2[modesShort[s.play_mode]],
			count: Math.round(s.beatmap.difficulty2[modesShort[s.play_mode]]),
	 }),
		"Mods":				 getScoreMods(s.mods, true),
		"Passed":			 T(s.completed >= 2 ? "Yes" : "No"),
		"Personal high score": T(s.completed === 3 ? "Yes" : "No")
	};

	// hits data
	var hd = {};
	var trans = modeTranslations[s.play_mode];
	[
		s.count_300,
		s.count_100,
		s.count_50,
		s.count_geki,
		s.count_katu,
		s.count_miss,
	].forEach(function(val, i) {
		hd[trans[i]] = val;
	});

	data = $.extend(data, hd, {
		"Ranked?":			T(s.completed == 3 ? "Yes" : "No"),
		"Achieved":		 s.time,
		"Mode":				 modes[s.play_mode],
	});

	var els = [];
	$.each(data, function(key, value) {
		els.push(
			$("<tr />").append(
				$("<td>" + T(key) + "</td>"),
				$("<td>" + value + "</td>")
			)
		);
	});

	$("#score-data-table tr").remove();
	$("#score-data-table").append(els);
	$(".ui.modal").modal("show");
}

var modeTranslations = [
	[
		"300s",
		"100s",
		"50s",
		"Gekis",
		"Katus",
		"Misses"
	],
	[
		"GREATs",
		"GOODs",
		"50s",
		"GREATs (Gekis)",
		"GOODs (Katus)",
		"Misses"
	],
	[
		"Fruits (300s)",
		"Ticks (100s)",
		"Droplets",
		"Gekis",
		"Droplet misses",
		"Misses"
	],
	[
		"300s",
		"200s",
		"50s",
		"Max 300s",
		"100s",
		"Misses"
	]
];

function getRank(gameMode, mods, acc, c300, c100, c50, cmiss) {
	var total = c300+c100+c50+cmiss;

	// Hidden | Flashlight | FadeIn
	var hdfl = (mods & (1049608)) > 0;

	var ss = hdfl ? "SSHD" : "SS";
	var s = hdfl ? "SHD" : "S";

	switch(gameMode) {
		case 0:
		case 1:
			var ratio300 = c300 / total;
			var ratio50 = c50 / total;

			if (ratio300 == 1)
				return ss;

			if (ratio300 > 0.9 && ratio50 <= 0.01 && cmiss == 0)
				return s;

			if ((ratio300 > 0.8 && cmiss == 0) || (ratio300 > 0.9))
				return "A";

			if ((ratio300 > 0.7 && cmiss == 0) || (ratio300 > 0.8))
				return "B";

			if (ratio300 > 0.6)
				return "C";

			return "D";

		case 2:
			if (acc == 100)
				return ss;

			if (acc > 98)
				return s;

			if (acc > 94)
				return "A";

			if (acc > 90)
				return "B";

			if (acc > 85)
				return "C";

			return "D";

		case 3:
			if (acc == 100)
				return ss;

			if (acc > 95)
				return s;

			if (acc > 90)
				return "A";

			if (acc > 80)
				return "B";

			if (acc > 70)
				return "C";

			return "D";
	}
}

function ppOrScore(pp, score) {
	if (pp != 0)
		return addCommas(pp.toFixed(2)) + "pp";
	return addCommas(score);
}

function beatmapLink(type, id) {
	if (type == "s")
		return "<a href='/s/" + id + "'>" + id + '</a>';
	return "<a href='/b/" + id + "'>" + id + '</a>';
}

