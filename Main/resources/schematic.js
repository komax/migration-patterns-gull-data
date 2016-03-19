/**
 * A schematic map layer that shows migration
 */

(function (global) {

//------------------------------------------------------------------------------

var defaults = {
	smallstop: [
		new ol.style.Fill({ color: [90, 180, 255, 1] }),
		new ol.style.Stroke({ color: [255, 255, 255, .5] }),
	],
	nodecolors: [
		new ol.style.Fill({ color: [45, 210,  80, .25] }),
		new ol.style.Fill({ color: [45, 180, 120, .25] }),
		new ol.style.Fill({ color: [45, 150, 150, .25] }),
		new ol.style.Fill({ color: [45, 120, 180, .25] }),
	],
}, selected = {
	smallstop: [
		new ol.style.Fill({ color: [165, 75, 0, 1] }),
		new ol.style.Stroke({ color: [255, 255, 255, .5] }),
	],
	nodecolors: [
		new ol.style.Fill({ color: [210, 45,  175, .5] }),
		new ol.style.Fill({ color: [210, 75, 135, .5] }),
		new ol.style.Fill({ color: [210, 105, 105, .5] }),
		new ol.style.Fill({ color: [210, 135, 75, .5] }),
	],
};

function nodeStyle(mode)
{
	return function (feature, resolution)
	{
		var radii = feature.get('radii').split(',').map(Number);
		if (radii.length < 4)
			return new ol.style.Style({
				image: new ol.style.Circle({
					fill: mode.smallstop[0],
					stroke: mode.smallstop[1],
					radius: 500 / resolution,
				}),
			});
		return radii.map(function (radius, i)
		{
			return new ol.style.Style({
				image: new ol.style.Circle({
					fill: mode.nodecolors[i],
					radius: radius / resolution,
				}),
			});
		});
	};
}

function edgeStyle(feature, resolution)
{
	var count = Math.min(feature.get('count'), 10)
	return new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: [90, 45, 180, count / 10],
			width: count / 1.5,
		}),
	});
}

function JSONfile(depth)
{
	return 'data/schematic_' + depth + '.geojsonp';
}

function Schematic()
{
	this.source = new ol.source.Vector({});
	this.layer = new ol.layer.Vector({
		source: this.source,
		style: function (feature, resolution)
		{
			var type = feature.get('type');
			if (type == 'node')
				return nodeStyle(defaults)(feature, resolution);
			else if (type == 'edge')
				return edgeStyle(feature, resolution);
		}
	});
	this.select = new ol.interaction.Select({
		layers: [this.layer],
		filter: function (d) { return d.get('type') == 'node'; },
		style: nodeStyle(selected),
		condition: ol.events.condition.click,
		toggleCondition: ol.events.condition.platformModifierKeyOnly,
	});
}

Schematic.prototype.load = function load(id)
{
	var self = this;
	$.ajax({
		url: JSONfile(id),
		dataType: 'jsonp',
		crossDomain: true,
		jsonpCallback: 'schemetic_' + id,
		success: function (data)
		{
			var geojson = new ol.format.GeoJSON(),
				features = geojson.readFeatures(data, {
					featureProjection: 'EPSG:3857'
				});
			self.source.clear();
			self.source.addFeatures(features);
		},
	});
}

Schematic.prototype.clear = function clear()
{
	this.source.clear();
}

//------------------------------------------------------------------------------

global.Schematic = Schematic;
global.Schematic.main = new Schematic();

})(window || this);

//------------------------------------------------------------------------------
