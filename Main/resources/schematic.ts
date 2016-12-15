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

    const styledText = new ol.style.Text({
        fill: new ol.style.Fill({
            color: 'white',
        }),
        stroke: new ol.style.Stroke({
            color: 'black',
            width: 3,
        }),
        font: '20px sans-serif',
        textAlign: "right",
        textBaseline: "bottom",
        offsetX: -10,
    });

    function nodeStyle(mode) {
        return function (feature: ol.Feature | ol.render.Feature, resolution: number): ol.style.Style | ol.style.Style[] {
            let radii = feature.get('radii').split(',').map(Number);

            if (radii.length < 4)
                return new ol.style.Style({
                    image: new ol.style.Circle({
                        fill: mode.smallstop[0],
                        stroke: mode.smallstop[1],
                        radius: 500 / resolution
                    }),
                    text: styledText
                });
            return radii.map(function (radius, i) {
                return new ol.style.Style({
                    image: new ol.style.Circle({
                        fill: mode.nodecolors[i],
                        radius: radius / resolution
                    }),
                    text: styledText
                    })
                });
        };
    }

    const edge_opacity = {
        1: 0.300000,
        2: 0.350000,
        3: 0.400000,
        4: 0.450000,
        5: 0.500000,
        6: 0.550000,
        7: 0.600000,
        8: 0.650000,
        9: 0.700000,
        10: 0.750000
    };

    function edgeStyle(feature: ol.Feature | ol.render.Feature, resolution: number): ol.style.Style {
        let gullIds = feature.get('ids');
        let mode = Main.inGullSelection(gullIds)
                ? selected : defaults,
            count = Math.min(feature.get('count'), 10),
            opacity = edge_opacity[count],
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

    function setTextOnStyle(style: ol.style.Style | ol.style.Style[], text: string): void {
        if (Array.isArray(style)) {
            for (let ns of style) {
                ns.getText().setText(text);
            }
        } else {
            style.getText().setText(text);
        }
    }

    export class Schematic {
        readonly source: ol.source.Vector;
        readonly layer: ol.layer.Vector;
        readonly stopoverSelect: ol.interaction.Select;
        readonly statisticsSelect: ol.interaction.Select;
        readonly stopoverStatisticsPopover: ol.Overlay;

        constructor() {
            this.source = new ol.source.Vector({});
            this.layer = new ol.layer.Vector({
                source: this.source,
                style: function (feature: ol.Feature, resolution): ol.style.Style | ol.style.Style[] {
                    let type = feature.get('type');
                    if (type == 'node') {
                        const nodestyle: ol.style.Style | ol.style.Style[] = nodeStyle(defaults)(feature, resolution);
                        const selectionNumber = feature.get('selectionNumber');
                        // Check whether the selection number exists, then update the text.
                        if (selectionNumber !== undefined) {
                            setTextOnStyle(nodestyle, `${selectionNumber}`);
                        } else {
                            setTextOnStyle(nodestyle, "");
                        }
                        return nodestyle;
                    } else if (type == 'edge') {
                        return edgeStyle(feature, resolution);
                    } else {
                        // Stop working if we want to style somethin different than edges and nodes.
                        throw new Error("Undefined type to style: only edge and node are allowed");
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
            this.statisticsSelect = new ol.interaction.Select({
                layers: [this.layer],
                filter: (f) => {
                    return f.get('type') === 'node';
                },
                style: nodeStyle(defaults),
                condition: ol.events.condition.pointerMove
            });


            this.stopoverStatisticsPopover = new ol.Overlay({
            });

            $(document).ready(() => {
                $('#stopover-statistics').tooltipster({contentAsHTML: true});

                let popUpElem: Element | null = document.getElementById('stopover-statistics');
                if (popUpElem === null) {
                    throw new Error("Cannot find elemement stopover-statistics in the html doc");
                }
                this.stopoverStatisticsPopover.setElement(popUpElem);
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
