/**
 * A map layer that shows the complete journey of a gull segmented on day/night
 */

(function (global) {

//------------------------------------------------------------------------------

var defaults = {	
	colors: ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'],
	style: function(color) {
		return new ol.style.Style({
			fill: new ol.style.Fill({ color: color }),
		})
	},
	heatmap_host : 'http://localhost:5000/'
};

function Heatmap()
{
	this.sources = []
	this.layers = []

	for (var i = 0; i < 5; i++){
		this.sources.push(new ol.source.Vector({}));
		this.layers.push(new ol.layer.Vector({
			source: this.sources[i],
			style: defaults.style(defaults.colors[i]),
		}));
	}
	
}

Heatmap.prototype.load = function load(ids)
{
	var self = this;
	var restful_url = defaults.heatmap_host + ids.join('$');

	$.ajax({
		url: restful_url,
		dataType: 'jsonp',
		crossDomain: true,
		jsonp: 'jsonpContours',
		jsonpCallback: 'jsonpContours',
		success: function (data)
		{
			var contourArray = [data.contour1, data.contour2, data.contour3, data.contour4, data.contour5]

			for (var i = 0; i < self.sources.length; i++)
			{
				var geojson = new ol.format.GeoJSON(),
					features = geojson.readFeatures(contourArray[i])
				self.sources[i].clear();
				self.sources[i].addFeatures(features);
			}

    		console.log("Succesfully loaded heatmap.")
		},
		error: function (xhr, status, error)
		{
    		console.log(error)
    		console.log("Could not retrieve heatmap.")
		},
	});
}

Heatmap.prototype.clear = function clear()
{
	for (var i = 0; i < this.layers.length; i++)
	{
		this.sources[i].clear();
	}
}

//------------------------------------------------------------------------------

global.Heatmap = Heatmap;
global.Heatmap.main = new Heatmap();

})(window || this);

//------------------------------------------------------------------------------
