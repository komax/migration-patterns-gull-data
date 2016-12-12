/// <reference path="../libraries/definitions/openlayers.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/**
 * A schematic map layer that shows migration
 */

namespace MigrationVisualization {

//------------------------------------------------------------------------------
    import ReadOptions = olx.format.ReadOptions;
    import StrokeOptions = olx.style.StrokeOptions;
    let defaults = {
        smallstop: [
            new ol.style.Fill({color: [90, 180, 255, 1]}),
            new ol.style.Stroke({color: [255, 255, 255, .5]})
        ],
        // Blue color scheme scheme (single hue from color brewer).
        nodecolors: [
            new ol.style.Fill({color: [158, 202, 225, .25]}),
            new ol.style.Fill({color: [107, 174, 214, .25]}),
            new ol.style.Fill({color: [49, 130, 189, .25]}),
            new ol.style.Fill({color: [8, 81, 156, .25]})
        ],
        // Grey for the edges.
        edgecolor: function (a: number): ol.Color {
            return [140, 140, 140, a] as ol.Color;
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
        return function (feature: ol.Feature | ol.render.Feature, resolution: number) {
            let radii = feature.get('radii').split(',').map(Number);
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

    function edgeStyle(feature: ol.Feature | ol.render.Feature, resolution: number) {
        let gullIds = feature.get('ids');
        let mode = Main.inGullSelection(gullIds)
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

    function jsonFile(depth): string {
        return 'data/schematic_' + depth + '.geojsonp';
    }

    export class Schematic {
        readonly source: ol.source.Vector;
        readonly layer: ol.layer.Vector;
        readonly stopoverSelect: ol.interaction.Select;

        constructor() {
            this.source = new ol.source.Vector({});
            this.layer = new ol.layer.Vector({
                source: this.source,
                style: function (feature, resolution) {
                    let type = feature.get('type');
                    if (type == 'node') {
                        return nodeStyle(defaults)(feature, resolution);
                    } else if (type == 'edge') {
                        return edgeStyle(feature, resolution);
                    }
                }
            });
            this.stopoverSelect = new ol.interaction.Select({
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
                        features: ol.Feature[] = geojson.readFeatures(data, {
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
