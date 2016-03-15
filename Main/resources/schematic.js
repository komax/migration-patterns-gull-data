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
		new ol.style.Fill({ color: [45, 210, 80, .25] }),
		new ol.style.Fill({ color: [45, 180, 120, .25] }),
		new ol.style.Fill({ color: [45, 150, 150, .25] }),
		new ol.style.Fill({ color: [45, 120, 180, .25] }),
	],
};

function nodeStyle(feature, resolution)
{
	var radii = feature.get('radii').split(',').map(Number);
	if (radii.length < 4)
		return new ol.style.Style({
			image: new ol.style.Circle({
				fill: defaults.smallstop[0],
				stroke: defaults.smallstop[1],
				radius: 500 / resolution,
			}),
		});
	return radii.map(function (radius, i)
	{
		return new ol.style.Style({
			image: new ol.style.Circle({
				fill: defaults.nodecolors[i],
				radius: radius / resolution,
			}),
		});
	});
}

function edgeStyle(feature, resolution)
{
	return new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: [90, 45, 180, 1],
			width: Math.min(feature.get('count'), 10),
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
				return nodeStyle(feature, resolution);
			else if (type == 'edge')
				return edgeStyle(feature, resolution);
		}
	});
}

Schematic.prototype.load = function load(id)
{
	var self = this;
	$.ajax({
		url: JSONfile(id),
		dataType: 'jsonp',
		crossDomain: true,
		jsonp: 'jsonpArrive',
		jsonpCallback: 'jsonpArrive',
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
