/**
 * Map setup and configuration
 */

(function (global) { $(function () {

var maps = {};

//------------------------------------------------------------------------------

// Todo: select appropriate layers
var layers = maps.layers = {
	mapquest: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'sat'}),
	}),
	topology: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'hyb'}),
	}),
	natural: new ol.layer.Tile({
		title: 'Global Imagery',
		source: new ol.source.TileWMS({
			url: 'http://demo.opengeo.org/geoserver/wms',
			params: { LAYERS: 'ne:NE1_HR_LC_SR_W_DR', VERSION: '1.1.1' }
			//params: { LAYERS: 'nasa:bluemarble', VERSION: '1.1.1' }
		})
	}),
};

maps.view = new ol.View({
	center: ol.proj.fromLonLat([5.488196, 51.4475088]),
	zoom: 9,
});

// For heatmap
maps.left = new ol.Map({
	target: 'left-map',
	layers: [ layers.natural ],
	view: maps.view,
});

// For migration map
maps.right = new ol.Map({
	target: 'right-map',
	layers: [ layers.mapquest ],
	view: maps.view,
});

//------------------------------------------------------------------------------

maps.resize = function resize()
{
	maps.left.updateSize();
	maps.right.updateSize();
}

//------------------------------------------------------------------------------

global.Maps = maps;

}); })(window || this);

//------------------------------------------------------------------------------
