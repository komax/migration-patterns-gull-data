var fs = require('fs'),
	args = require('minimist')(process.argv.slice(2)),
	utils = require('./lib/utils.js')
	input = args._[0],
	output = args._[1] || '.',
	jsonp = args.p || args.jsonp,
	space = args.s || args.space;

if (!input || !output)
{
	console.log('Gull data formatting')
	console.log('Usage:\n\t' + process.argv.slice(0, 2).join(' ') + '[flags] <input.json> [output/path]\n\n'+
		'\t-s --space=[string]\t\tformats json using optimally a whitespace string');
	process.exit();
}

// \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/

var extractor = [
	function journeys(gulls)
	{
		var output = [];
		for (var id in gulls)
		{
			if (!gulls[id].journey) continue;
			output.push({
				filename: 'journey_' + id.replace(' ', '_') + '.geojsonp',
				padding: ['jsonpArrive(', ');'],
				data: {
					type: 'FeatureCollection',
					features: [
						{
							type: 'Feature',
							geometry: {
								type: 'LineString',
								coordinates: gulls[id].journey.coords
								.map(function (d) { return [d[1], d[0]]; }),
							},
							properties: {
								idle: gulls[id].journey.idle
									.map(utils.decimals(2))
									.map(function (d) { return Math.max(d, 1); }),
							},
						},
					],
					crs: { type: 'name', properties: { name: 'EPSG:4326' } },
				},
			});
		}
		return output;
	},
	function schematic(gulls)
	{
		if (!gulls.migration || !gulls.migration[500]) return;
		var migration = gulls.migration[500];
		return {
			filename: 'schematic_500.geojsonp',
			padding: ['jsonpArrive(', ');'],
			data: {
				type: 'FeatureCollection',
				features: migration.nodes.map(function (d)
				{
					return {
						type: 'Feature',
						geometry: {
							type: 'Point',
							coordinates: [d.center[1], d.center[0]],
						},
						properties: {
							radii: d.radii
								.map(utils.decimals(0))
								.join(','),
						},
					};
				}),
				crs: { type: 'name', properties: { name: 'EPSG:4326' } },
			},
		};
	},
];


// /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\


console.log('Reading...');
var indata = JSON.parse(fs.readFileSync(input)),
	outdata = [];

console.log('\nExtracting:');
for (var i = 0, l = extractor.length; i < l; ++i)
{
	process.stdout.write(extractor[i].name + '... ');
	var out = extractor[i](indata);
	if (Array.isArray(out))
		Array.prototype.push.apply(outdata, out);
	else
		outdata.push(out);
	process.stdout.write('\n');
}

console.log('\nWriting...');
if (space && typeof space != 'string')
	space = '\t';
for (var i = 0, l = outdata.length; i < l; ++i)
{
	var out = outdata[i];
	console.log(out.filename);
	fs.writeFileSync(output + '/' + out.filename,
		out.padding[0] + JSON.stringify(out.data, null, space) + out.padding[1]);
}
console.log('Done!');