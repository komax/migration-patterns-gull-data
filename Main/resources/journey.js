/**
 * A map layer that shows the complete journey of a gull segmented on day/night
 */

(function (global) {

//------------------------------------------------------------------------------

var defaults = {
	day: new ol.style.Style({
		stroke: new ol.style.Stroke({
			//color: [220, 20, 60, .8],
			color: [120, 200, 240, .8],
			width: 3,
		}),
	}),
	night: new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: [40, 10, 40, .8],
			width: 3,
		}),
	}),
	twilight: new ol.style.Style({
		stroke: new ol.style.Stroke({
			//color: [90, 180, 220, .8],
			color: [180, 90, 220, .8],
			width: 3,
		}),
	}),
};

function JSONfile(id)
{
	return 'data/journey_' + id.replace(' ', '_') + '.geojsonp';
}

function Journey()
{
	this.source = new ol.source.Vector({});
	this.layer = new ol.layer.Vector({
		source: this.source,
		style: function (feature, resolution)
		{
			var type = feature.get('type');
			return defaults[type];
		},
	});
}

Journey.prototype.load = function load(id)
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

Journey.prototype.clear = function clear()
{
	this.source.clear();
}

//------------------------------------------------------------------------------

global.Journey = Journey;
global.Journey.main = new Journey();

})(window || this);

//------------------------------------------------------------------------------
