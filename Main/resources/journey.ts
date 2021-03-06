/// <reference path="../libraries/definitions/openlayers.d.ts" />
/// <reference path="../libraries/definitions/d3.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/**
 * A map layer that shows the complete journey of a gull segmented on day/night
 */

namespace MigrationVisualization {

//------------------------------------------------------------------------------

    import ReadOptions = olx.format.ReadOptions;
    import Feature = ol.Feature;
    let defaults = {
        day: new ol.style.Style({
            stroke: new ol.style.Stroke({
                //color: [220, 20, 60, .8],
                color: [120, 200, 240, .8],
                width: 4,
            }),
        }),
        night: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: [40, 10, 40, .8],
                width: 4,
            }),
        }),
        twilight: new ol.style.Style({
            stroke: new ol.style.Stroke({
                //color: [90, 180, 220, .8],
                color: [180, 90, 220, .8],
                width: 4,
            }),
        }),
        text: {
            fill: new ol.style.Fill({
                color: 'black',
            }),
            stroke: new ol.style.Stroke({
                color: 'white',
                width: 2,
            }),
        },
        stop: new ol.style.Circle({
            radius: 22,
            fill: new ol.style.Fill({
                color: [145, 207, 96, 1.],
            }),
            stroke: new ol.style.Stroke({
                color: 'white',
            }),
        }),
    };

    let dateStamp = d3.time.format('%b %d\n%Y'),
        timeStamp = d3.time.format('%b %d %Y\n%-I:%M %p');

    function labelStyle(feature, resolution) {
        let top = feature.get('features')[0],
            stamp = resolution > 500 ? dateStamp : timeStamp;
        return new ol.style.Style({
            text: new ol.style.Text({
                font: 'bold 13px sans-serif',
                text: stamp(new Date(top.get('date'))),
                fill: defaults.text.fill,
                stroke: defaults.text.stroke,
            }),
            image: defaults.stop,
        });
    }

    function JSONkey(id): string {
        return 'journey_' + id.replace(' ', '_');
    }

    function JSONfile(id): string {
        return 'data/' + JSONkey(id) + '.geojsonp';
    }

    export class Journey {
        private source1: ol.source.Vector;
        private layer1: ol.layer.Vector;
        private source2: ol.source.Vector;
        private layer2: ol.layer.Vector;
        readonly layer: ol.layer.Group;

        private textLabelFeatures: ol.Feature[];
        private showTextLabel: boolean;

        constructor() {
            this.source1 = new ol.source.Vector({});
            this.layer1 = new ol.layer.Vector({
                source: this.source1,
                style: function (feature, resolution) {
                    let type = feature.get('type');
                    return defaults[type];
                },
            });
            this.source2 = new ol.source.Vector({});
            this.layer2 = new ol.layer.Vector({
                source: new ol.source.Cluster({
                    distance: 50,
                    source: this.source2,
                }),
                style: labelStyle,
            });
            this.layer = new ol.layer.Group({
                layers: [this.layer1, this.layer2],
            });

            this.showTextLabel = true;

            // Press delete to remove the current selection.
            const eventHandler = (e) => {
                // if t key is pressed.
                if (e.which === 84) {
                    this.showTextLabel = !this.showTextLabel;
                    if (this.showTextLabel) {
                        this.source2.addFeatures(this.textLabelFeatures);
                        showPopUpInformation("Show stopovers as text labels within the trajectory.", 1500);
                    } else {
                        this.textLabelFeatures = this.source2.getFeatures();
                        this.source2.clear(true);
                        showPopUpInformation("Turn off text labels within the trajectory.", 1500);
                    }
                }
            };

            document.addEventListener("keydown", eventHandler.bind(this));
        }

        load(id) {
            $.ajax({
                url: JSONfile(id),
                dataType: 'jsonp',
                cache: false,
                crossDomain: true,
                jsonpCallback: JSONkey(id),
                success: (data) => {
                    let geojson = new ol.format.GeoJSON(),
                        features: Feature[] = geojson.readFeatures(data, {
                            featureProjection: 'EPSG:3857'
                        } as ReadOptions);
                    this.source1.clear();
                    this.source2.clear();
                    this.source1.addFeatures(features.filter(function (feature: Feature) {
                        return feature.get('type') != 'stop';
                    }));
                    this.textLabelFeatures = features.filter(function (feature: Feature) {
                        return feature.get('type') == 'stop';
                    });
                    if (this.showTextLabel) {
                        this.source2.addFeatures(this.textLabelFeatures);
                    }
                },
            });
        };

        clear() {
            this.source1.clear();
            this.source2.clear();
        }
    }

    export const journey = new Journey();

}

//------------------------------------------------------------------------------
