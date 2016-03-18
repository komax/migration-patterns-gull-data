var fs = require('fs'),
	args = require('minimist')(process.argv.slice(2)),
	utils = require('./lib/utils.js'),
	cluster = require('./lib/clusterer.js'),
	cluster2 = require('./lib/clusterer2.js'),
	input = args._[0],
	output = args._[1],
	jsonp = args.p || args.jsonp,
	space = args.s || args.space,
	names = args.names ? args.names.split(',') : undefined,
	depths = args.depth || 20;

if (!input || !output)
{
	console.log('Gull data processing')
	console.log('Usage:\n\t' + process.argv.slice(0, 2).join(' ') + '[flags] <input.json> <output.json>\n\n'+
		'\t-p -jsonp=<name>\t\toutputs jsonp instead of json, prepends "var name = "\n'+
		'\t-s --space=[string]\t\tformats json using optimally a whitespace string\n'+
		'\t--stop-threshold=[number]\n'+
		'\t--stop-distance=[number]\n'+
		'\t--depth=[number]\t\tnumber of nodes the schematic contains\n'+
		'\t--names=name[,name2]\t\tonly process gulls with specified names (default is all birds)');
	process.exit();
}





//\/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ 

var STOP_THRESHOLD = args['stop-threshold'] || 3.5,
	STOP_DISTANCE = args['stop-distance'] || 500; // meter

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var preprocessor = [
		function filter(gulls)
		{
			if (!names) return;
			for (var id in gulls)
				if (names.indexOf(gulls[id].organismName) < 0)
					delete gulls[id];
		},
		function find_idlespots(gulls, data)
		{
			data.idlespots = {};
			for (var id in gulls)
			{
				data.idlespots[id] = [];

				var gull = gulls[id],
					len = gull.secondsSinceLastOccurrence.length;
				for (var i = 1; i < len; ++i)
				{
					var dtime = gull.secondsSinceLastOccurrence[i],
						ddist = utils.distance(
							gull.decimalLatitude[i],
							gull.decimalLongitude[i],
							gull.decimalLatitude[i - 1],
							gull.decimalLongitude[i - 1]),
						idle = Math.log(dtime / ddist);
					if (idle > STOP_THRESHOLD)
					{
						// Linear interpolation between segment points, error should be small enough
						var lat = (gull.decimalLatitude[i] + gull.decimalLatitude[i - 1]) / 2,
							lon = (gull.decimalLongitude[i] + gull.decimalLongitude[i - 1]) / 2;
						data.idlespots[id].push([lat, lon]);
					}
				}
			}
		},
		function find_stops(gulls, data)
		{
			var status = new utils.Percentage(Object.keys(gulls).length);
			data.stops = {};
			for (var id in gulls)
			{
				data.stops[id] = cluster(data.idlespots[id], STOP_DISTANCE);
				status.increase();
			}
			status.done();
		},
		function find_stop_events(gulls, data)
		{
			var status = new utils.Percentage(Object.keys(gulls).length);
			data.events = {};
			for (var id in gulls)
			{
				var gull = gulls[id],
					len = gull.secondsSinceLastOccurrence.length;
				data.events[id] = [];
				for (var i = data.stops[id].length - 1; i >= 0; --i)
				{
					var stop = data.stops[id][i],
						index = undefined,
						min = Infinity;
					for (var j = 0; j < len; ++j)
					{
						var lat = gull.decimalLatitude[j],
							lon = gull.decimalLongitude[j],
							center = stop.center,
							dist = utils.distance(
								lat, lon, center[0], center[1]) - stop.radius - STOP_DISTANCE;
						if (dist < 0)
						{
							if (dist < min)
							{
								min = dist;
								index = gull.eventDate[j];
							}
						}
						else if (index)
						{
							data.events[id].push(index);
							index = undefined;
							min = Infinity;
						}
					}
					if (index)
						data.events[id].push(index);
				}
				status.increase();
			}
			status.done();
		},
		function cluster_stops(gulls, data)
		{
			var points = [],
				lut = [];
			for (var id in gulls)
			{
				data.stops[id].forEach(function (stop, i)
				{
					points.push(stop.center);
					delete stop.coords; // We don't really need them
					lut.push({ id: id, stopid: i, stop: stop});
				});
			}
			data.stoptree = cluster2(points, function (a, b)
			{
				a = lut[a].stop;
				b = lut[b].stop;
				return utils.distance(
					a.center[0],
					a.center[1],
					b.center[0],
					b.center[1]) - a.radius - b.radius;
			});
			(function lookup(node)
			{
				if (!Array.isArray(node))
					return;

				if (Array.isArray(node[0]))
					lookup(node[0]);
				else
					node[0] = lut[node[0]];

				if (Array.isArray(node[1]))
					lookup(node[1]);
				else
					node[1] = lut[node[1]];
			})(data.stoptree);
		},
	];

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var processor = {
	name: function (gull, data) { return gull.organismName; },
	sex: function (gull, data) { return gull.sex; },
	/*$idle: function (gull, data)
	{
		var dtime = gull.secondsSinceLastOccurrence,
			ddist = utils.distance(
				gull.decimalLatitude,
				gull.decimalLongitude,
				gull.last.decimalLatitude,
				gull.last.decimalLongitude),
			idle = Math.log(dtime / ddist);
		return +(idle > STOP_THRESHOLD);
	},*/
	$journey: function (gull, data)
	{
		gull.daynight = utils.daynight(
			gull.eventDate,
			gull.decimalLatitude,
			gull.decimalLongitude);
		gull.twilight = utils.twilight(
			gull.eventDate,
			gull.decimalLatitude);
		gull.designation = gull.daynight > 0 ? 'day'
			: gull.daynight < gull.twilight ? 'night'
			: 'twilight';
		gull.day = gull.last.day || 1;

		var dtime = gull.secondsSinceLastOccurrence,
			ddist = utils.distance(
				gull.decimalLatitude,
				gull.decimalLongitude,
				gull.last.decimalLatitude,
				gull.last.decimalLongitude);
		gull.idle = Math.log(dtime / ddist);

		var row = {
			date: gull.eventDate,
			coords: [gull.decimalLatitude, gull.decimalLongitude],
			idle: gull.idle,
		};
		if (gull.first || gull.last.designation != gull.designation)
		{
			var row2 = {
				date: row.date,
				coords: row.coords,
				type: gull.designation,
				day: gull.day,
			}
			if (gull.designation == 'night')
				gull.day++;
			row = new Segment(row2, row);
		}
		return row;
	},
	$trajectory: function (gull, data)
	{
		gull.daynight = utils.daynight(
			gull.eventDate,
			gull.decimalLatitude,
			gull.decimalLongitude);

		var row = {};
		if (gull.first
		|| data.events[gull.id].indexOf(gull.eventDate) >= 0)
		{
			var stopid = utils.closest_stop(
				data.stops[gull.id],
				gull.decimalLatitude,
				gull.decimalLongitude)[0],
				stop = data.stops[gull.id][stopid];

			row = new Segment({
				date: gull.eventDate,
				coords: [gull.decimalLatitude, gull.decimalLongitude],
				daynight: gull.daynight,
				source: stopid,
				id: gull.id,
			}, {
				date: gull.eventDate,
				coords: [gull.decimalLatitude, gull.decimalLongitude],
				daynight: gull.daynight,
				destination: stopid,
			});

			data.stopindex = data.stopindex || {};
			if (!(gull.id in data.stopindex))
			{
				data.stopindex[gull.id] = 0;
				(stop.incomming = stop.incomming || []).push(0);
				(stop.outgoing = stop.outgoing || []).push(0);
			}
			else
			{
				var index = data.stopindex[gull.id]++;
				(stop.incomming = stop.incomming || []).push(index);
				(stop.outgoing = stop.outgoing || []).push(index + 1);
			}
		}
		else
			row = {
				date: gull.eventDate,
				coords: [gull.decimalLatitude, gull.decimalLongitude],
				daynight: gull.daynight,
			}

		return { legs: row };
	},
	stops: function (gull, data)
	{
		return data.stops[gull.id].map(function (stop)
		{
			return stop;
		});
	}
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var postprocessor = [
	/*function write_stops(gulls, data)
	{
		var dist = 15000;
		function collect(node)
		{
			if (typeof node[2] == 'object')
				return [node[2]];
			return collect(node[0]).concat(collect(node[1]));
		}
		function fold(node)
		{
			if (typeof node[2] == 'object')
				return node;
			else if (node[2] < dist)
				return utils.fast_enclosing_circle(collect(node));
			else
				return [fold(node[0]), fold(node[1]), node[2]];
		}
		gulls.stops = fold(data.stoptree);
	},*/
	function generate_schematree(gulls, data)
	{
		function Node(stops, legs)
		{
			var points = stops.slice(0);
			for (var i = legs.length - 1; i >= 0; --i)
				Array.prototype.push.apply(points, legs[i].coords);
			this.center = utils.fast_enclosing_circle(points).center;
			this.radii = [];

			// Calculate quartiles for leg distances from center
			if (!legs || !legs.length) return;
			var dists = [],
				times = 0;
			for (var i = legs.length - 1; i >= 0; --i)
			{
				for (var j = legs[i].coords.length - 2; j >= 0; --j)
				{
					var time = (legs[i].date[j+1] - legs[i].date[j]) / 1000,
						a = legs[i].coords[j+1],
						b = legs[i].coords[j],
						c = this.center,
						dist = (utils.distance(a[0], a[1], c[0], c[1])
							+ utils.distance(b[0], b[1], c[0], c[1])) / 2;
					dists.push([time, dist]);
					times += time;
				}
			}
			dists.sort(function (a, b) { return b[1] - a[1]; });
			this.radii.push(dists[0][1]);
			times /= 4;
			for (var i = 0, l = dists.length, q = 0; i < l; q += dists[i++][0])
			{
				if (q <= times) continue;
				q -= times;
				this.radii.push(dists[i][1]);
			}

			// Generate arrival, departure string
			this.events = {};
			for (var i = legs.length - 1; i >= 0; --i)
			{
				var id = legs[i].id,
					departure = legs[i].date[0],
					arrival = legs[i].date[legs[i].date.length - 1];
				if (!(id in this.events))
					this.events[id] = new utils.Range();
				this.events[id].add(departure, arrival);
			}
			for (var id in this.events)
				this.events[id] = this.events[id].merge().toArray();
		}

		function Edge(left, right, edges)
		{
			this.u = utils.fast_enclosing_circle(left).center;
			this.v = utils.fast_enclosing_circle(right).center;
			this.uv = edges[0].length;
			this.vu = edges[1].length;
		}

		function countLeafs(node)
		{
			return Array.isArray(node)
				? countLeafs(node[0]) + countLeafs(node[1])
				: 1;
		}

		function find_stops(node)
		{
			if (!Array.isArray(node))
				return [node.stop];
			var arr = [];
			Array.prototype.push.apply(arr, find_stops(node[0]));
			Array.prototype.push.apply(arr, find_stops(node[1]));
			return arr;
		}

		function stop_find_loops(leaf /*= {id: ..., stopid: ..., stop: ...}*/ )
		{
			var gull = gulls[leaf.id],
				stop = leaf.stop,
				legs = [];
			if (!('incomming' in stop))
				return legs;
			for (var i = stop.incomming.length - 1; i >= 0; --i)
			{
				var legid = stop.incomming[i];
				if (stop.outgoing.indexOf(legid) >= 0)
					legs.push(gull.trajectory.legs[legid]);
			}
			return legs;
		}

		function hash_nodes(node, hash)
		{
			hash = hash || {};
			if (Array.isArray(node))
			{
				hash_nodes(node[0], hash);
				hash_nodes(node[1], hash);
				return hash;
			}
			hash[node.id] = hash[node.id] || {
				incomming: {},
				outgoing: {},
			};
			if ('incomming' in node.stop)
				for (var i = node.stop.incomming.length - 1; i >= 0; --i)
					hash[node.id].incomming[node.stop.incomming[i]] = true;
			if ('outgoing' in node.stop)
				for (var i = node.stop.outgoing.length - 1; i >= 0; --i)
					hash[node.id].outgoing[node.stop.outgoing[i]] = true;
			return hash;
		}

		function find_loops(node)
		{
			var hash = hash_nodes(node),
				legs = [];
			for (var id in hash)
				for (var legid in hash[id].incomming)
					if (legid in hash[id].outgoing)
						legs.push(gulls[id].trajectory.legs[legid]);
			return legs;
		}

		function find_edges(left, right)
		{
			var lefthash = hash_nodes(left),
				righthash = hash_nodes(right),
				legs = [[],[]];

			for (var id in lefthash)
				for (var legid in lefthash[id].outgoing)
					if (id in righthash && legid in righthash[id].incomming)
						legs[0].push(gulls[id].trajectory.legs[legid]);
			for (var id in righthash)
				for (var legid in righthash[id].outgoing)
					if (id in lefthash && legid in lefthash[id].incomming)
						legs[1].push(gulls[id].trajectory.legs[legid]);
			return legs;
		}

		function parseEdge(left, right)
		{
			var edges = find_edges(left, right),
				leftdepth = Array.isArray(left) ? left[3] : -1,
				rightdepth = Array.isArray(right) ? right[3] : -1;
			if (!edges[0].length && !edges[1].length)
				return undefined;

			var leftstops = find_stops(left),
				rightstops = find_stops(right),
				edge = new Edge(leftstops, rightstops, edges);
			if (leftdepth > rightdepth)
				return [leftdepth, edge,
					parseEdge(left[0], right), parseEdge(left[1], right)];
			else if (rightdepth > leftdepth)
				return [rightdepth, edge,
					parseEdge(left, right[0]), parseEdge(left, right[1])];
			else
			{
				if (leftdepth >= 0)
					throw new Error('Edge depth inconsistency detected!');
				return [-1, edge];
			}
		}

		var count = countLeafs(data.stoptree),
			status = new utils.Percentage(count),
			maxdepth = data.stoptree[3] - depths - 1;
		data.schematree = (function parseNode(node /*= [left, right, dist, depth]*/)
		{
			if (!Array.isArray(node)) // node is a leaf
			{
				status.increase();
				return [-1, new Node([node.stop], stop_find_loops(node))];
			}
			else if (node[3] < maxdepth)
			{
				status.increase(countLeafs(node));
				return [node[3], new Node(find_stops(node), find_loops(node))];
			}

			var left = parseNode(node[0]),
				right = parseNode(node[1]),
				obj = new Node(find_stops(node), find_loops(node)),
				edge = parseEdge(node[0], node[1]);

			return [node[3], obj, left, right, edge];
		})(data.stoptree);
		status.done();
	},

	function extract_schema(gulls, data)
	{
		function extract_depth(depth)
		{
			var nodes = [],
				edges = [];

			function parse_node(node)
			{
				if (!node) return;
				if (node[0] < depth)
					return nodes.push(node[1]);
				parse_node(node[2]);
				parse_node(node[3]);
				parse_edge(node[4]);
			}

			function parse_edge(edge)
			{
				if (!edge) return;
				if (edge[0] < depth)
					return edges.push(edge[1]);
				parse_edge(edge[2]);
				parse_edge(edge[3]);
			}

			parse_node(data.schematree);
			return { nodes: nodes, edges: edges };
		}

		gulls.migration = {};
		for (var i = 0, max = data.schematree[0]; i < depths; ++i)
			gulls.migration[i] = extract_depth(max - i);
	},
];

///\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ 








var indata = JSON.parse(fs.readFileSync(input)),
	data = {},
	outdata = {};

console.log('Preprocessing:');
for (var i = 0, l = preprocessor.length; i < l; ++i)
{
	process.stdout.write(preprocessor[i].name + '... ');
	preprocessor[i](indata, data);
	process.stdout.write('\n');
}

console.log('\nProcessing:');
for (var id in indata)
{
	process.stdout.write(id + '... ');
	outdata[id] = {};
	indata[id].id = id;
	for (var x in processor)
	{
		if (x[0] == '$')
			outdata[id][x.substr(1)] = all(processor[x], indata[id], data);
		else
			outdata[id][x] = processor[x](indata[id], data);
	}
	process.stdout.write('\n');
}

console.log('\nPostprocessing:');
for (var i = 0, l = postprocessor.length; i < l; ++i)
{
	process.stdout.write(postprocessor[i].name + '... ');
	postprocessor[i](outdata, data);
	process.stdout.write('\n');
}

console.log('\nWriting...');
if (space && typeof space != 'string')
	space = '\t';
if (jsonp)
	fs.writeFileSync(output, 'var ' + jsonp + ' = ' + JSON.stringify(outdata, null, space));
else
	fs.writeFileSync(output, JSON.stringify(outdata, null, space));
console.log('Done!');

function all(func, obj, data)
{
	var values = {},
		count = Infinity,
		dst = {_:undefined},
		last = {};
	for (var x in obj)
		if (Array.isArray(obj[x]))
			count = Math.min(count, obj[x].length);
		else
			values[x] = obj[x];
	function get(index)
	{
		var obj2 = Object.create(values);
		for (var x in obj)
			if (!(x in values))
				obj2[x] = obj[x][index];
		obj2.last = last;
		last = obj2;
		return obj2;
	}
	function set(dst, src)
	{
		if (Array.isArray(dst))
			dst = dst[dst.length - 1];
		for (var x in src)
		{
			if (src[x] && src[x].constructor == Segment)
			{
				if (!Array.isArray(dst[x]))
				{
					if (!dst[x])
						dst[x] = [];
					else
						dst[x] = [dst[x]];
				}
				else if (src[x].last)
					set(dst[x], src[x].last);
				dst[x].push({});
				set(dst[x], src[x].first);
			}
			else if (src[x] && src[x].constructor == Object)
			{
				if (!dst[x]) dst[x] = {};
				set(dst[x], src[x]);
			}
			else if (src[x] !== undefined)
			{
				if (!dst[x])
					dst[x] = src[x];
				else
				{
					if (!Array.isArray(dst[x]) || !dst[x].$)
					{
						dst[x] = [dst[x]];
						dst[x].$ = true;
					}
					dst[x].push(src[x]);
				}
			}
		}
	}
	var last;
	for (var i = 0; i < count; ++i)
	{
		var current = get(i);
		if (!i)
			current.first = true;
		set(dst, {_:func(current, data)});
		delete current.last;
	}
	return dst._;
}

function Segment(first, last)
{
	this.first = first;
	this.last = last;
}

//------------------------------------------------------------------------------
