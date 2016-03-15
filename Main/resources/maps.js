/**
 * Map setup and configuration
 */

(function (global) { $(function () {

var maps = {};

//------------------------------------------------------------------------------
// Heatmap layers
colors = ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'];
var contourArray = [contours.contour1, contours.contour2, contours.contour3, contours.contour4, contours.contour5]
var heatmapLayers = [];
for (var i = 0; i < contourArray.length; i++)
{
	heatmapLayers.push(new ol.layer.Vector({
		source: new ol.source.Vector({
			features: (new ol.format.GeoJSON()).readFeatures(contourArray[i])}),
			style: new ol.style.Style({
				fill: new ol.style.Fill({ color: colors[i] }),
			})
		}));
}

//------------------------------------------------------------------------------

var layers = maps.layers = {
	mapquest: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'sat'}),
	}),
	topology: new ol.layer.Tile({
		source: new ol.source.MapQuest({ layer: 'hyb'}),
	}),
	positronLeft: new ol.layer.Tile({
		source: new ol.source.XYZ({
			url: 'http://{a-c}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
			format: new ol.format.KML()
		})
	}),
	positronRight: new ol.layer.Tile({
		source: new ol.source.XYZ({
			url: 'http://{a-c}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
			format: new ol.format.KML()
		}),
		visible: false
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
	center: ol.proj.fromLonLat([5.488196, 51.4475088]),
	zoom: 9,
});

// For heatmap
maps.left = new ol.Map({
	controls: ol.control.defaults()
		.extend([
			new window.interface.expandControl('#right-view')
		]),
	target: 'left-map',
	layers: [ layers.positronLeft, layers.journey ]
		.concat(heatmapLayers),
	view: maps.view,
});

// For migration map
maps.right = new ol.Map({	
	controls: ol.control.defaults()
		.extend([
			new window.interface.expandControl('#left-view')
		]),
	target: 'right-map',
	layers: [ layers.positronLeft, layers.schematic ],
	view: maps.view,
});

// Since mapquest doesn't show images at a zoom level higher than 11, we want
// to switch to positron if zoomed in further. Hence we need a hook on the zoom event.
maps.right.getView().on('change:resolution', function()
{
	var zoomLevel = maps.right.getView().getZoom();
	var usePositron = (zoomLevel >= 12);
	layers.mapquest.setVisible(!usePositron);
	layers.positronRight.setVisible(usePositron);
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
