/**
 * Map setup and configuration
 */

(function (global) { $(function () {

var maps = {};

//------------------------------------------------------------------------------

var layers = maps.layers = {
	mapquestLeft: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'sat'}),
	}),
	mapquestRight: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'sat'}),
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
		]),
	target: 'left-map',
	layers: [ layers.positron, layers.mapquestLeft]
		.concat(Heatmap.main.layers)
		.concat([Journey.main.layer]),
	view: maps.view,
});

// For migration map
maps.right = new ol.Map({	
	controls: ol.control.defaults()
		.extend([
			new window.interface.expandControl('#right-view', '#left-view','|_', '_|_'),
			new window.interface.settingsControl('#right-toolbar', '#right-view','_|', '_|_'),
			new window.interface.paneControl('#pane', '45%', '=', '_'),
		]),
	target: 'right-map',
	layers: [ layers.positron, layers.mapquestRight, layers.schematic ],
	view: maps.view,
	interactions: ol.interaction.defaults()
		.extend([ Schematic.main.select ]),
});

// Since mapquest doesn't show images at a zoom level higher than 11, we want
// to switch to positron if zoomed in further. Hence we need a hook on the zoom event.
maps.right.getView().on('change:resolution', function()
{
	var zoomLevel = maps.right.getView().getZoom();
	var usePositron = (zoomLevel >= 12);
	layers.mapquest.setVisible(!usePositron);
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
