/**
 * A map layer that shows the complete journey of a gull segmented on day/night
 */

(function (global) {

//------------------------------------------------------------------------------

function JSONfile(id)
{
	return 'data/journey_' + id.replace(' ', '_') + '.geojsonp';
}

function Journey()
{
	this.source = new ol.source.Vector({});
	this.layer = new ol.layer.Vector({ source: this.source });
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
