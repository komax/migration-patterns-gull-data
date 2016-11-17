/// <reference path="../libraries/definitions/openlayers.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/**
 * A schematic map layer that shows migration
 */

namespace MigrationVisualization {

//------------------------------------------------------------------------------
    import ReadOptions = olx.format.ReadOptions;
    import StrokeOptions = olx.style.StrokeOptions;
    var defaults = {
        smallstop: [
            new ol.style.Fill({color: [90, 180, 255, 1]}),
            new ol.style.Stroke({color: [255, 255, 255, .5]})
        ],
        nodecolors: [
            new ol.style.Fill({color: [45, 210, 80, .25]}),
            new ol.style.Fill({color: [45, 180, 120, .25]}),
            new ol.style.Fill({color: [45, 150, 150, .25]}),
            new ol.style.Fill({color: [45, 120, 180, .25]})
        ],
        edgecolor: function (a: number): ol.Color {
            return [90, 45, 180, a] as ol.Color;
        }
    }, selected = {
        smallstop: [
            new ol.style.Fill({color: [165, 75, 0, 1]}),
            new ol.style.Stroke({color: [255, 255, 255, .5]})
        ],
        nodecolors: [
            new ol.style.Fill({color: [210, 45, 175, .5]}),
            new ol.style.Fill({color: [210, 75, 135, .5]}),
            new ol.style.Fill({color: [210, 105, 105, .5]}),
            new ol.style.Fill({color: [210, 135, 75, .5]})
        ],
        edgecolor: (a: number) => {
            return [180, 45, 180, a] as ol.Color;
        }
    };

    function nodeStyle(mode) {
        return function (feature, resolution) {
            var radii = feature.get('radii').split(',').map(Number);
            if (radii.length < 4)
                return new ol.style.Style({
                    image: new ol.style.Circle({
                        fill: mode.smallstop[0],
                        stroke: mode.smallstop[1],
                        radius: 500 / resolution
                    })
                });
            return radii.map(function (radius, i) {
                return new ol.style.Style({
                    image: new ol.style.Circle({
                        fill: mode.nodecolors[i],
                        radius: radius / resolution
                    })
                });
            });
        };
    }

    function edgeStyle(feature, resolution) {
        var mode = Main.inGullSelection(feature.get('ids'))
                ? selected : defaults,
            count = Math.min(feature.get('count'), 10),
            opacity = count / 10,
            width = count / 1.5;

        if (mode == selected) {
            opacity = Math.min(opacity + 0.1, 1);
            width += 1;
        }

        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: <ol.Color>mode.edgecolor(opacity),
                width: width
            })
        });
    }

    function jsonFile(depth) {
        return 'data/schematic_' + depth + '.geojsonp';
    }

    export class Schematic {
        readonly source: ol.source.Vector;
        readonly layer: ol.layer.Vector;
        readonly select: ol.interaction.Select;

        constructor() {
            this.source = new ol.source.Vector({});
            this.layer = new ol.layer.Vector({
                source: this.source,
                style: function (feature, resolution) {
                    var type = feature.get('type');
                    if (type == 'node') {
                        return nodeStyle(defaults)(feature, resolution);
                    } else if (type == 'edge') {
                        return edgeStyle(feature, resolution);
                    }
                }
            });
            this.select = new ol.interaction.Select({
                layers: [this.layer],
                filter: function (d) {
                    return d.get('type') == 'node';
                },
                style: nodeStyle(selected),
                condition: ol.events.condition.click,
                toggleCondition: ol.events.condition.platformModifierKeyOnly
            });
        }

        load(id) {
            $.ajax({
                url: jsonFile(id),
                dataType: 'jsonp',
                crossDomain: true,
                jsonpCallback: 'schemetic_' + id,
                success: (data) => {
                    let geojson = new ol.format.GeoJSON(),
                        features = geojson.readFeatures(data, {
                            dataProjection: 'EPSG:3857',
                            featureProjection: 'EPSG:3857'
                        } as ReadOptions);
                    this.source.clear();
                    this.source.addFeatures(features);
                }
            });
        }

        clear() {
            this.source.clear();
        }

        refresh() {
            this.source.dispatchEvent('change');
        }
    }

    export const schematic: Schematic = new Schematic();
}

//------------------------------------------------------------------------------
