/**
 * A schematic map layer that shows migration
 */

(function (global) {

//------------------------------------------------------------------------------

var defaults = {
	smallstop: new ol.style.Style({
		image: new ol.style.Circle({
			fill: new ol.style.Fill({ color: [90, 180, 255, .5] }),
			stroke: new ol.style.Stroke({ color: [255, 255, 255, .5] }),
			radius: 5,
		}),
	}),
	nodecolors: [
		new ol.style.Fill({ color: [45, 210, 80, .25] }),
		new ol.style.Fill({ color: [45, 180, 120, .25] }),
		new ol.style.Fill({ color: [45, 150, 150, .25] }),
		new ol.style.Fill({ color: [45, 120, 180, .25] }),
	],
};

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
			var radii = feature.get('radii').split(',').map(Number);
			if (radii.length < 4)
				return defaults.smallstop;
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
