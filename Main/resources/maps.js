/**
 * Map setup and configuration
 */

(function (global) { $(function () {

var maps = {};

//------------------------------------------------------------------------------

var layers = maps.layers = {
	mapquestLeft: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'sat'}),
		minResolution: 50,
	}),
	mapquestRight: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'sat'}),
		minResolution: 50,
	}),
	topologyLeft: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'hyb'}),
	}),
	topologyRight: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'hyb'}),
	}),
	positron: new ol.layer.Tile({
		source: new ol.source.XYZ({
			url: 'http://{a-c}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
			format: new ol.format.KML()
		})
	}),
	natural: new ol.layer.Tile({
		title: 'Global Imagery',
		source: new ol.source.TileWMS({
			url: 'http://demo.opengeo.org/geoserver/wms',
			params: { LAYERS: 'ne:NE1_HR_LC_SR_W_DR', VERSION: '1.1.1' }
			//params: { LAYERS: 'nasa:bluemarble', VERSION: '1.1.1' }
		})
	}),
	journey: Journey.main.layer,
	schematic: Schematic.main.layer,
};

maps.view = new ol.View({
	center: ol.proj.fromLonLat([-0.234747,38.0422329]),
	zoom: 4.25,
});

// For heatmap
maps.left = new ol.Map({
	controls: ol.control.defaults()
		.extend([
			new window.interface.expandControl('#left-view', '#right-view','_|', '_|_'),
			new window.interface.settingsControl('#left-toolbar', '#right-view','_|', '_|_'),
  			new ol.control.ScaleLine(),
		]),
	target: 'left-map',
	layers: [ layers.positron, layers.mapquestLeft]
		.concat(Heatmap.main.layers)
		.concat([layers.topologyLeft, Journey.main.layer]),
	view: maps.view,
});

// For migration map
maps.right = new ol.Map({	
	controls: ol.control.defaults()
		.extend([
			new window.interface.expandControl('#right-view', '#left-view','|_', '_|_'),
			new window.interface.settingsControl('#right-toolbar', '#right-view','_|', '_|_'),
			new window.interface.paneControl('#pane', '45%', '=', '_'),
  			new ol.control.ScaleLine(),
		]),
	target: 'right-map',
	layers: [ layers.positron, layers.mapquestRight, layers.topologyRight, layers.schematic ],
	view: maps.view,
	interactions: ol.interaction.defaults()
		.extend([ Schematic.main.select ]),
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
