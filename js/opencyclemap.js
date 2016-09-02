		
		//Our Location
		//var x = 48.16;
		//var y = 11.6;
		var functions = require('./functions');
        var L = require('leaflet');
		var LC = require('leaflet.locatecontrol');

		var mymap=null;

		exports.setUpMap = function(x,y) {
            L.Icon.Default.imagePath = 'node_modules/leaflet/dist/images/';
			mymap = L.map('map').setView([x, y], 17);
			window.map = mymap; // Set map as a global variable

			L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpandmbXliNDBjZWd2M2x6bDk3c2ZtOTkifQ._QA7i5Mpkd_m30IGElHziw', {
			maxZoom: 18,
			attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
				'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
				'Imagery © <a href="http://mapbox.com">Mapbox</a>',
			id: 'mapbox.streets'
			}).addTo(mymap);

			LC = L.control.locate().addTo(map);

			var MyControl = L.Control.extend({
				options: {
					position: 'bottomright'
				},

				onAdd: function (map) {
					var container = L.DomUtil.create('div', 'leaflet-time-slider-container');
					var timeSlider = L.DomUtil.create('div', 'leaflet-time-slider', container);
					var slider = L.DomUtil.create('div', 'leaflet-time-slider-bar', timeSlider);
					var slider = L.DomUtil.create('div', 'leaflet-time-slider-from', timeSlider);
					var slider = L.DomUtil.create('div', 'leaflet-time-slider-to', timeSlider);
					timeSlider.title = 'Change time range';
					return container;
				}
			});

			map.addControl(new MyControl());

			/*var popup = L.popup();

			function onMapClick(e) {
				popup
					.setLatLng(e.latlng)
					.setContent("You clicked the map at " + e.latlng.toString())
					.openOn(mymap);
			}

			mymap.on('click', onMapClick);*/
		}

		exports.setUpLocation = function(x,y) {
			if(mymap==null) return;

			L.marker([x,y]).addTo(mymap).bindPopup("Your location.");

			L.circle([x, y], 200, {
				color: '#808080',
				fillColor: 'red',
				fillOpacity: 0.1
			}).addTo(mymap).bindPopup("Pokemons appear here!");
		}

		/* filter Pokemon by passing from & to as date-objects */
		exports.loadPokemonData = function(callback, from, to) {
			if(typeof from === "undefined" || !(from instanceof Date)) {
				from = new Date();
				console.log("parameter 'from' is no date-object and will be changed to " + from.toString());
			}
			if(typeof to === "undefined" || !(to instanceof Date)) {
				to = new Date(from.getTime());
				to.setMonth(to.getMonth() + 1);
				console.log("parameter 'to' is no date-object and will be changed to " + to.toString());
			}
			functions.loadJson("json/predicted-data.json", function(response) {
				var predictedData = JSON.parse(response);
				console.log("loaded predicted pokemon (" + predictedData.length + " found)");
				var predictedData = predictedData.filter(function(pokemon) {
					var pokemonTime = new Date(pokemon.time);
					if(pokemonTime < from) return false;
					if(to < pokemonTime) return false;
					return true;
				});
				console.log("filtered pokemon from " + from.toString() + " to " + to.toString() + " (" + predictedData.length + " found)");
				functions.loadJson("json/pokemonbasicinfo.json", function(response) {
					var staticData = JSON.parse(response);
					for(var i = 0, n = predictedData.length; i < n; ++i) {
						predictedData[i] = functions.mergeObjects(predictedData[i], staticData[predictedData[i].name]);
						console.log("added static data for " + predictedData[i].name);
					}
					callback(predictedData);
				});
			});
		}

		exports.generatePokemonMapData = function(predictedData) {
			var pokemonMapData = {
				"type": "FeatureCollection",
				"features": []
			};
			for(var i = 0, n = predictedData.length; i < n; ++i) {
				pokemonMapData.features.push({
					"id": i,
					"type": "Feature",
					"geometry": {
						"type": "Point",
						"coordinates": [predictedData[i].longitude, predictedData[i].latitude]
					},
					"properties": {
						"name": predictedData[i].name,
						"time": predictedData[i].time,
						"type": predictedData[i].type,
						"evolution": predictedData[i].evolution,
						"probability": predictedData[i].probability,
						"img": "img/" + predictedData[i].name.toLowerCase() + ".png"
					}
				});
				console.log("generated map data for " + predictedData[i].name);
			}
			return pokemonMapData
		}


		exports.setPokemonOnMap = function(predictedData) {
			var pokemonMapData = exports.generatePokemonMapData(predictedData);
			if(mymap==null) return;

			var pokemonIcon = L.Icon.extend(
			{
				options:{
					iconSize: [35,35]
				}
			});

			function onEachFeature(feature, layer) {
				var popupContent = "<div>";
                popupContent += "<div class='pokemonInfo'><div class='probabilityhelper' ><div class='pokemonprobability'>" + feature.properties.probability * 100 + "%</div></div><div class='pokemonname'>" + feature.properties.name + "</div>" + "<span class=''></span><button class='pokemonmore fa fa-book' onclick='showAdditionalInformation(\""+ feature.properties.name + "\")'></button>";
                popupContent+= "</div><div class='allinfo'>";
				popupContent += "<div class='pokemontime'><span class='poklabel'>Time of appearance: </span> " + feature.properties.time.replace("T", " ").slice(0, 16) + " UTC</div>";
				popupContent += "<div class='pokemontime'><span class='poklabel'>Time until appearance: </span> <span id='countdown_" + feature.id + "'></span></div>";
                popupContent += "</div></div>";
				layer.bindPopup(popupContent);

				layer.on({click: function(e) {functions.initializeCountdown("countdown_" + e.target.feature.id, new Date(e.target.feature.properties.time));}});
			}

			var pokemonLayer = L.geoJson(pokemonMapData, {

				onEachFeature: onEachFeature,

				pointToLayer: function (feature, latlng) {
					var pokemon = new pokemonIcon({iconUrl: feature.properties.img});
					var pokname = feature.properties.name;
					return L.marker(latlng, {icon: pokemon, title:pokname,rinseOnHover:true});
				},

				/*filter: function(feature, layer) {
					var pokemonTime = new Date(feature.properties.time);
					if(pokemonTime < from) return false;
					if(to < pokemonTime) return false;
					return true;
				},*/

			}).addTo(map);
		}


		showAdditionalInformation = function(name) {
			functions.loadJson("json/pokemonbasicinfo.json", function(response) {
				var staticData = JSON.parse(response);
				var pokemon = staticData[name];
				document.getElementById("map").style.width = "calc(100% - 410px)";
				document.getElementById("sidebar").style.display = "block";
				document.getElementById("avatar").innerHTML = "<img src='img/" + name.toLowerCase() + ".png' alt='Avatar not found'>";
				document.getElementById("name").innerHTML = name;
				document.getElementById("height").innerHTML = pokemon.height;
				document.getElementById("weight").innerHTML = pokemon.weight;
				document.getElementById("typetitle").innerHTML = functions.typeTitle(pokemon.type);
				document.getElementById("type").innerHTML = functions.objectValuesToString(pokemon.type);
				document.getElementById("category").innerHTML = pokemon.category[1];
				document.getElementById("evolution").innerHTML = functions.evolutionToString(pokemon.evolution, name);
				document.getElementById("weaknessestitle").innerHTML = functions.weaknessesTitle(pokemon.weaknesses);
				document.getElementById("weaknesses").innerHTML = functions.objectValuesToString(pokemon.weaknesses);
				document.getElementById("hp").innerHTML = pokemon.stats.HP;
				document.getElementById("attack").innerHTML = pokemon.stats.Attack;
				document.getElementById("defense").innerHTML = pokemon.stats.Defense;
				document.getElementById("specialattack").innerHTML = pokemon.stats.SpecialAttack;
				document.getElementById("specialdefense").innerHTML = pokemon.stats.SpecialDefense;
				document.getElementById("speed").innerHTML = pokemon.stats.Speed;
				document.getElementById("abilities").innerHTML = functions.abilitiesToTable(pokemon.ability);
				document.getElementById("abilitiestitle").innerHTML = functions.abilitiesTitle(pokemon.ability);
			});

		}

		hideAdditionalInformation = function() {
			document.getElementById("map").style.width = "100%";
			document.getElementById("sidebar").style.display = "none";
		}
        
    