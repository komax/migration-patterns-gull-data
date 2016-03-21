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
			if (!gulls[id].trajectory)
				gulls[id].trajectory = { legs: [] };
			else if (!Array.isArray(gulls[id].trajectory.legs))
				gulls[id].trajectory.legs = [gulls[id].trajectory.legs];

			var key = 'journey_' + id.replace(' ', '_');
			output.push({
				filename:  key + '.geojsonp',
				padding: [key + '(', ');'],
				data: {
					type: 'FeatureCollection',
					features: gulls[id].journey.map(function (segment)
					{
						if (!Array.isArray(segment.idle))
							segment.idle = [segment.idle];
						return {
							type: 'Feature',
							geometry: {
								type: 'LineString',
								coordinates: segment.coords
									.map(function (d) { return [d[1], d[0]]; }),
							},
							properties: {
								type: segment.type,
								//day: segment.day,
								date: segment.date[0],
								//idle: segment.idle
								//	.map(utils.decimals(2))
								//	.map(function (d) { return Math.max(d, 1); }),
							},
						};
					}).concat(gulls[id].trajectory.legs.map(function (trajectory)
					{
						var coords = trajectory.coords[0];
						return {
							type: 'Feature',
							geometry: {
								type: 'Point',
								coordinates: [coords[1], coords[0]],
							},
							properties: {
								type: 'stop',
								date: trajectory.date[0],
							},
						};
					})),
					crs: { type: 'name', properties: { name: 'EPSG:4326' } },
				},
			});
		}
		return output;
	},
	function schematic(gulls)
	{
		if (!gulls.migration) return;

		var output = [];
		for (var depth in gulls.migration)
		{
			var migration = gulls.migration[depth];
			output.push({
				filename: 'schematic_' + depth + '.geojsonp',
				padding: ['schemetic_' + depth + '(', ');'],
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
								type: 'node',
								radii: d.radii
									.map(utils.decimals(0))
									.join(','),
								events: d.events,
							},
						};
					}).concat(migration.edges.map(function (d)
					{
						return {
							type: 'Feature',
							geometry: {
								type: 'LineString',
								coordinates: [
									[d.u[1], d.u[0]],
									[d.v[1], d.v[0]],
								],
							},
							properties: {
								type: 'edge',
								count: d.uv + d.vu,
							},
						};
					})),
					crs: { type: 'name', properties: { name: 'EPSG:4326' } },
				},
			});
		}
		return output;
	},
	function organism(gulls)
	{
		var output = {};
		for (var id in gulls)
		{
			var gull = gulls[id];
			output[id] = {
				name: gull.name,
				sex: gull.sex,
			}
		}
		return {
			filename: 'organisms.jsonp',
			padding: ['organisms(', ');'],
			data: output,
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
	else if (out)
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