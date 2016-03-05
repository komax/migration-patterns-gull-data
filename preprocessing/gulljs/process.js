var fs = require('fs'),
	args = require('minimist')(process.argv.slice(2)),
	input = args._[0],
	output = args._[1];

if (!input || !output)
{
	console.log('Gull data processing')
	console.log('Usage:\n\t' + process.argv.slice(0, 2).join(' ') + ' <input.json> <output.json>');
	process.exit();
}





//\/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ \/ 

var STOP_THESHOLD = 3.5,
	STOP_DISTANCE = 500; // meter

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var preprocessor = [
		function filter(gulls)
		{
			/*for (var id in gulls)
				if (gulls[id].organismName != 'Sanne')
					delete gulls[id];*/
		},
		function find_idlespots(gulls, data)
		{
			data.idlespots = [];
			for (var id in gulls)
			{
				var gull = gulls[id],
					len = gull.secondsSinceLastOccurrence.length;
				for (var i = 1; i < len; ++i)
				{
					var dtime = gull.secondsSinceLastOccurrence[i],
						ddist = distance(
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
						data.idlespots.push([lat, lon]);
					}
				}
			}
		},
		function find_stops(gulls, data)
		{
			/*
			data.stops = []
			for (var i = data.idlespots.length - 1; i >= 0; --i)
				data.stops.push({ center: data.idlespots[i], });
			return;/**/

			// Sort points on lattitude
			data.idlespots.sort(function (a, b) { return a[0] - b[0]; });

			// clustering datastructure
			var clusters = [];
			function find(a)
			{
				if (!clusters[a])
					return clusters[a] = a;
				while (clusters[a] != a)
					a = clusters[a] = clusters[clusters[a]];
				return a;
			}
			function cluster(a, b)
			{
				a = find(a);
				b = find(b);
				if (a != b)
					clusters[b] = a;
			}

			// clustering on distance disks, uses fact that points are sorted on lattitude
			var spots = data.idlespots;
			for (var i = 0, top = 0, l = spots.length; i < l; ++i)
			{
				if (!(i % 5000))
					console.log(((i / l) * 100).toFixed(2) + '%', top - i);

				while ((top + 1 < l) && distance(spots[top + 1][0], 0, spots[i][0], 0) <= STOP_DISTANCE)
					++top;

				for (var j = i + 1; j <= top; ++j)
					if (distance(spots[i][0], spots[i][1], spots[j][0], spots[j][1]) <= STOP_DISTANCE)
						cluster(i, j);
			}

			var stops = {};
			for (var i = spots.length - 1; i >= 0; --i)
			{
				var j = find(clusters[i]);
				if (!(j in stops))
					stops[j] = [spots[i]];
				else
					stops[j].push(spots[i]);
			}
			clusters = null;
			delete data.idlespots;

			// write clusters
			data.stops = [];
			for (var x in stops)
			{
				var cluster = stops[x],
					lat = 0,
					lon = 0,
					dist = 0;
				for (var j = cluster.length - 1; j >= 0; --j)
				{
					lat += cluster[j][0];
					lon += cluster[j][1];
				}
				lat /= cluster.length;
				lon /= cluster.length;
				for (var j = cluster.length - 1; j >= 0; --j)
					dist = Math.max(dist, distance(lat, lon, cluster[j][0], cluster[j][1]));
				data.stops.push({
					center: [lat, lon],
					radius: dist + STOP_DISTANCE,
					coords: cluster,
				});
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
			ddist = distance(
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
		row.daynight = gull.daynight = daynight(
			gull.eventDate,
			gull.decimalLatitude,
			gull.decimalLongitude);

		var dtime = gull.secondsSinceLastOccurrence,
			ddist = distance(
				gull.decimalLatitude,
				gull.decimalLongitude,
				gull.last.decimalLatitude,
				gull.last.decimalLongitude);
		gull.idle = Math.log(dtime / ddist);

		/*if (gull.idle > STOP_THESHOLD || gull.last.stopdist)
		{
			var stopdist = closest_stop(
				data.stops,
				gull.decimalLatitude,
				gull.decimalLongitude);
			if (!gull.last.stopdist || gull.last.stopdist[0] == stopdist[0])
				gull.stopdist = stopdist;
		}*/

		if (gull.first
		|| gull.idle > STOP_THESHOLD
		|| (gull.last.stopdist && !gull.stopdist))
		{
			row.type = (data.odd = !data.odd) ? 'day' : 'night';
			row = new Segment(row);
		}
		return { legs: row };
	},
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var postprocessor = [
	function write_stops(gulls, data)
	{
		gulls.stops = data.stops;
	}
];

//------------------------------------------------------------------------------

// Geodistance between two corodinates
function distance(lat1, lon1, lat2, lon2)
{
	var alat = Math.sin((lat2 - lat1) * Math.PI / 360),
		alon = Math.sin((lon2 - lon1) * Math.PI / 360),
		clat1 = Math.cos(lat1 * Math.PI / 180),
		clat2 = Math.cos(lat2 * Math.PI / 180),
		a = (alat * alat) + (alon * alon) * clat1 * clat2,
		c = Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 2;
	return c * 6371000; // radius of Earth more or less
}

// Returns the time of day at a specific longitude,
// Range: [ 0 , 24 )
function timeofday(utc, lon)
{
	var timeofday = ((utc - (3600 * 1000)) / (3600 * 1000)) % 24;
	return (24 + timeofday + (lon / 15)) % 24; // Correct for longitude
}

// Returns the length of day in hours (approximated obviously)
// Based on: http://mathforum.org/library/drmath/view/56478.html
function lengthofday(utc, lat)
{
	var J = (utc - (new Date((new Date(utc)).getUTCFullYear(), 0, 1))) / (24 * 3600 * 1000),
		P = Math.asin(.39795 * Math.cos(.2163108
			+ Math.atan(.9671396 * Math.tan(.00860 * (J - 186))) * 2)),
		L = lat * Math.PI / 180,
		D = Math.acos((Math.sin(.8333 * Math.PI / 180) + Math.sin(L) * Math.sin(P)) /
			(Math.cos(L) * Math.cos(P)));
	return 24 - D * (24 / Math.PI);
}

// Returns daylight figure where 1 is noon and -1 is midnight and 0 is sun set.
function daynight(utc, lat, lon)
{
	var T = timeofday(utc, lon),
		Dh = lengthofday(utc, lat) / 2,
		O = Dh - Math.abs(T - 12);
	if (O < 0)
		Dh = 12 - Dh;
	return O / Dh;
}

// Finds the closest stop in an array of stops to a certain coordinate
// Returns [index of stop, distance to stop center]
function closest_stop(stops, lat, lon)
{
	var min = Infinity,
		index = undefined;
	for (var i = stops.length - 1; i >= 0; --i)
	{
		var c =  stops[i].center,
			d = distance(lat, lon, c[0], c[1]);
		if (d < min)
		{
			min = d;
			index = i;
		}
	}
	return [index, min];
}

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
	for (var x in processor)
	{
		if (x[0] == '$')
			outdata[id][x.substr(1)] = all(processor[x], indata[id], data);
		else
			outdata[id][x] = processor[x](indata[id], data);
	}
}

console.log('Postprocessing:');
for (var i = 0, l = postprocessor.length; i < l; ++i)
{
	console.log(postprocessor[i].name + '...');
	postprocessor[i](outdata, data);
}

console.log('\nWriting...');
fs.writeFileSync(output, JSON.stringify(outdata));
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

/*
var filename1 = 'lesser_black_gulls.txt',
	filename2 = 'organism.txt',
	data = {},
	last,
	leg = 0,
	filter = function (id, data)
	{
		return id in {
			'L909887': 1,
		};
	},
	process = function (row, last)
	{
		row.push(distance(last[1][0], last[1][1], row[1][0], row[1][1])); // displacement
		row.push(row[2] * 1000 / (row[0] - last[0]) || 0); // 'speed'
		row.push(daynight(row[0], row[1][0], row[1][1])); // 'light figure'
		row.push((row[0] - last[0]) / 1000);
		return row;
	},
	segment = function (row, last)
	{
		return (row[4] < 0) != (last[4] < 0);
	};

// file1:
// <organismID>
// [eventDate] [secondsSinceLastOccurrence]
// [decimalLatitude] [decimalLongitude]
// [minimumDistanceAboveSurfaceInMeters] [coordinateUncertaintyInMeters]

// file2:
// <organismID>
// [deviceInfoSerial] [organismName] [sex] [scientificName]

lr.eachLine(filename1, function (line)
{
	var row = line.split('\t'),
		id = row.shift();
	if (!filter(id, data)) return;
	if (!(id in data))
	{
		data[id] = {
			trajectory: { legs: [ { coords: [], type: 'day' } ], },
		}
		last = undefined;
	}
	row = [
		+(new Date(row[0])),
		[+row[2], +row[3]],
	];
	if (!last) last = row;
	row = process(row, last);
	if (segment(row, last))
	{
		data[id].trajectory.legs[leg].coords.push(row);
		++leg;
		data[id].trajectory.legs[leg] = { coords: [], type: row[4] >= 0 ? 'day' : 'night' };
	}
	data[id].trajectory.legs[leg].coords.push(row);
	last = row;
}, function ()
{
	lr.eachLine(filename2, function (line)
	{
		var row = line.split('\t'),
			id = row.shift();
		if (!filter(id, data)) return;
		if (!(id in data)) data[id] = {};
		data[id].name = row[1];
		data[id].sex = row[2];
		data[id].species = row[3];
	}, function ()
	{
		//fs.writeFileSync('gulldata.js', 'var gulldata = ' + JSON.stringify(data) + ';');
		fs.writeFileSync('gulldata.js', JSON.stringify(data));
	});
});
*/
