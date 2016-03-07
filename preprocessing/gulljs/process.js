var fs = require('fs'),
	args = require('minimist')(process.argv.slice(2)),
	utils = require('./lib/utils.js'),
	cluster = require('./lib/clusterer.js'),
	input = args._[0],
	output = args._[1],
	jsonp = args.p || args.jsonp,
	space = args.s || args.space;

if (!input || !output)
{
	console.log('Gull data processing')
	console.log('Usage:\n\t' + process.argv.slice(0, 2).join(' ') + '[flags] <input.json> <output.json>\n\n'+
		'\t-p -jsonp=<name>\t\toutputs jsonp instead of json, prepends "var name = "\n'+
		'\t-s --space=[string]\t\tformats json using optimally a whitespace string');
	process.exit();
}





//\/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ 

var STOP_THESHOLD = 3.5,
	STOP_DISTANCE = 500; // meter

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var preprocessor = [
		/** /function filter(gulls)
		{
			for (var id in gulls)
				if (gulls[id].organismName != 'Sanne')
					delete gulls[id];
		},//*/
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
					if (idle > STOP_THESHOLD)
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
			var count = 0,
				total = Object.keys(gulls).length;

			data.stops = {};
			for (var id in gulls)
			{
				data.stops[id] = cluster(data.idlespots[id], STOP_DISTANCE);
				console.log((count++ / total * 100).toFixed(2)+'%');
			}
			console.log('100%');
		},
		function find_stop_events(gulls, data)
		{
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
			}
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
		return +(idle > STOP_THESHOLD);
	},*/
	$trajectory: function (gull, data)
	{
		var row = {}
		row.date = gull.eventDate;
		row.coords = [gull.decimalLatitude, gull.decimalLongitude];
		row.daynight = gull.daynight = utils.daynight(
			gull.eventDate,
			gull.decimalLatitude,
			gull.decimalLongitude);
		gull.stop = utils.closest_stop(
				data.stops[gull.id],
				gull.decimalLatitude,
				gull.decimalLongitude);

		// Filter out all inter and in-stop data points.
		/*if (!gull.first
		&& gull.stop[1] <= STOP_THESHOLD == gull.last.stop[1] < STOP_DISTANCE)
			return;*/

		if (gull.first
		|| data.events[gull.id].indexOf(gull.last.eventDate) >= 0)
		{
			row.type = (data.odd = !data.odd) ? 'day' : 'night';
			row = new Segment(row);
		}
		return { legs: row };
	},
	stops: function (gull, data)
	{
		return data.stops[gull.id].map(function (stop)
		{
			return stop.center;
		});
	}
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var postprocessor = [
	/*function write_stops(gulls, data)
	{
		gulls.stops = data.stops;
	},*/
];

///\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ /\ 








var indata = JSON.parse(fs.readFileSync(input)),
	data = {},
	outdata = {};

console.log('Preprocessing:');
for (var i = 0, l = preprocessor.length; i < l; ++i)
{
	console.log(preprocessor[i].name + '...');
	preprocessor[i](indata, data);
}

console.log('\nProcessing:');
for (var id in indata)
{
	console.log(id + '...');
	outdata[id] = {};
	indata[id].id = id;
	for (var x in processor)
	{
		if (x[0] == '$')
			outdata[id][x.substr(1)] = all(processor[x], indata[id], data);
		else
			outdata[id][x] = processor[x](indata[id], data);
	}
}

console.log('\nPostprocessing:');
for (var i = 0, l = postprocessor.length; i < l; ++i)
{
	console.log(postprocessor[i].name + '...');
	postprocessor[i](outdata, data);
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
				dst[x].push({});
				set(dst[x], src[x].value);
			}
			else if (src[x] && src[x].constructor == Object)
			{
				if (!dst[x]) dst[x] = {};
				set(dst[x], src[x]);
			}
			else if (src[x] !== undefined)
			{
				if (!dst[x]) dst[x] = [];
				dst[x].push(src[x]);
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

function Segment(x)
{
	this.value = x;
}

//------------------------------------------------------------------------------
