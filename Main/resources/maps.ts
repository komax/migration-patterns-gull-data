/// <reference path="../libraries/definitions/openlayers.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />

/**
 * Map setup and configuration
 */

interface Window {
    "interface";
}

namespace MigrationVisualization {
    import Layer = ol.layer.Layer;
    export const maps: any = {};
    $(function () {


//------------------------------------------------------------------------------

        let layers = maps.layers = {
            satelliteLeft: new ol.layer.Tile({
                // Use DigitalGlobe Maps API: Recent Imagery with Streets
                source: new ol.source.XYZ({
                    url: 'http://api.tiles.mapbox.com/v4/digitalglobe.nal0mpda/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNpcGg5dHkzYTAxM290bG1kemJraHU5bmoifQ.CHhq1DFgZPSQQC-DYWpzaQ', // You will need to replace the 'access_token' and 'Map ID' values with your own. http://developer.digitalglobe.com/docs/maps-api
                }),
               // minResolution: 50,
            }),
            satelliteRight: new ol.layer.Tile({
                // Use DigitalGlobe Maps API: Recent Imagery with Streets
                source: new ol.source.XYZ({
                    url: 'http://api.tiles.mapbox.com/v4/digitalglobe.nal0mpda/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZGlnaXRhbGdsb2JlIiwiYSI6ImNpcGg5dHkzYTAxM290bG1kemJraHU5bmoifQ.CHhq1DFgZPSQQC-DYWpzaQ', // You will need to replace the 'access_token' and 'Map ID' values with your own. http://developer.digitalglobe.com/docs/maps-api
                }),
                //minResolution: 50,
            }),
            topologyLeft: new ol.layer.Tile({
                source: new ol.source.CartoDB({} as any),
            }),
            topologyRight: new ol.layer.Tile({
                source: new ol.source.CartoDB({} as any),
            }),
            positron: new ol.layer.Tile({
                source: new ol.source.XYZ({
                    url: 'http://{a-c}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
                    //format: new ol.format.KML()
                })
            }),
            // natural: new ol.layer.Tile({
            //     //title: 'Global Imagery',
            //     source: new ol.source.TileWMS({
            //         url: 'http://demo.opengeo.org/geoserver/wms',
            //         params: {LAYERS: 'ne:NE1_HR_LC_SR_W_DR', VERSION: '1.1.1'}
            //         //params: { LAYERS: 'nasa:bluemarble', VERSION: '1.1.1' }
            //     })
            // }),
            journey: journey.layer,
            schematic: schematic.layer,
        };

        maps.view = new ol.View({
            center: ol.proj.fromLonLat([-0.234747, 38.0422329]),
            zoom: 4.25,
        });

// For heatmap
        maps.left = new ol.Map({
            controls: ol.control.defaults()
                .extend([
                    new window.interface.expandControl('#left-view', '#right-view', '_|', '_|_'),
                    new window.interface.settingsControl('#left-toolbar', '#right-view', '_|', '_|_'),
                    new ol.control.ScaleLine(),
                ]),
            target: 'left-map',
            layers: <Layer[]>[layers.positron, layers.satelliteLeft]
                .concat(heatmap.layers as any)
                .concat([layers.topologyLeft, journey.layer] as any),
            view: maps.view,
        });

// For migration map
        maps.right = new ol.Map({
            controls: ol.control.defaults()
                .extend([
                    new window.interface.expandControl('#right-view', '#left-view', '|_', '_|_'),
                    new window.interface.settingsControl('#right-toolbar', '#right-view', '_|', '_|_'),
                    new window.interface.paneControl('#pane', '45%', '=', '_'),
                    new ol.control.ScaleLine(),
                ]),
            target: 'right-map',
            layers: [layers.positron, layers.satelliteRight, layers.topologyRight, layers.schematic],
            view: maps.view,
            interactions: ol.interaction.defaults()
                .extend([schematic.stopoverSelect, schematic.statisticsSelect]),
        });

//------------------------------------------------------------------------------

        maps.resize = function resize() {
            maps.left.updateSize();
            maps.right.updateSize();
        };

//------------------------------------------------------------------------------


    });
}

//------------------------------------------------------------------------------
