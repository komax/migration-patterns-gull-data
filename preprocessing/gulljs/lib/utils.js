
var rl = require('readline');

//------------------------------------------------------------------------------

// Geodistance between two coordinates
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

//------------------------------------------------------------------------------

// Returns the time of day at a specific longitude,
// Range: [ 0 , 24 )
function timeofday(utc, lon)
{
	var timeofday = ((utc - (3600 * 1000)) / (3600 * 1000)) % 24;
	return (24 + timeofday + (lon / 15)) % 24; // Correct for longitude
}

//------------------------------------------------------------------------------

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

//------------------------------------------------------------------------------

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

//------------------------------------------------------------------------------

// Finds the closest stop in an array of stops to a certain coordinate
// Returns [index of stop, distance to stop center]
function closest_stop(stops, lat, lon)
{
	var min = Infinity,
		index = undefined;
	for (var i = stops.length - 1; i >= 0; --i)
	{
		var stop = stops[i],
			center = stop.center,
			dist = distance(lat, lon, center[0], center[1]) - stop.radius;
		if (dist < min)
		{
			min = dist;
			index = i;
		}
	}
	return [index, min];
}

//------------------------------------------------------------------------------
// Component that prints status information interactively on the command line

function Percentage(total)
{
	this.total = total;
	this.count = 0;
	this.lastLength = 0;
	this.set(0);
}

Percentage.prototype.set = function set(count)
{
	if (this.lastLength === null)
		return;
	this.count = count;
	var text = (this.count * 100 / this.total).toFixed(2) + '%';

	rl.moveCursor(process.stdout, -this.lastLength);
	rl.clearLine(process.stdout, 1);
	process.stdout.write(text);
	this.lastLength = text.length;
}

Percentage.prototype.increase = function increase(number)
{
	number = number || 1;
	this.set(this.count + number);
}

Percentage.prototype.done = function done()
{
	rl.moveCursor(process.stdout, -this.lastLength);
	rl.clearLine(process.stdout, 1);
	process.stdout.write('done!');
	this.lastLength = null;
}

//------------------------------------------------------------------------------
// Union-find data structure with path compression for effective set-union

function Forest(range)
{
	this.clusters = Array(range);
}

Forest.prototype.find = function (a)
{
	var parent = this.clusters;
	if (parent[a] === undefined)
		return parent[a] = a;
	if (parent[a] != a)
		parent[a] = this.find(parent[a]);
	return parent[a];
}

Forest.prototype.union = function (a, b)
{
	a = this.find(a);
	b = this.find(b);
	this.clusters[b] = a;
	return a != b;
}

//------------------------------------------------------------------------------
// Ritter's enclosing circle algorithm
// We can certainly do better than this

function fast_enclosing_circle(circles)
{
	circles = circles.map(function (circle)
	{
		if (Array.isArray(circle))
			return [circle[0], circle[1], 0];
		else
			return [circle.center[0], circle.center[1], circle.radius];
	});

	if (circles.length < 2)
		return { center: [circles[0][0], circles[0][1]], radius: circles[0][2] };
		
	var x = circles[(circles.length * Math.random()) << 0],
		y = extract_furthest(circles, x),
		z = extract_furthest(circles, y),
		circle = enclose(y, z);

	while (circles.length)
		circle = enclose(circle, circles.pop());

	return { center: [circle[0], circle[1]], radius: circle[2] };
}

function extract_furthest(circles, x)
{
	var y = undefined,
		j = undefined,
		max = -Infinity;
	for (var i = circles.length - 1; i >= 0; --i)
	{
		if (circles[i] == x) continue;
		var d = distance(x[0], x[1], circles[i][0], circles[i][1]);
		if (d > max)
		{
			y = circles[i];
			j = i;
			max = d;
		}
	}
	circles.splice(j, 1);
	return y;
}

function enclose(c1, c2)
{
	var vx = c2[0] - c1[0],
		vy = c2[1] - c1[1],
		rs = c1[2] + c2[2],
		d = distance(c1[0], c1[1], c2[0], c2[1]);
	if (d <= rs) return c1;
	var r = (d + rs) / 2,
		cx = c1[0] + vx * (r - c1[2]) / d,
		cy = c1[1] + vy * (r - c1[2]) / d;
	return [cx, cy, r];
}

//------------------------------------------------------------------------------

module.exports.distance = distance;
module.exports.timeofday = timeofday;
module.exports.lengthofday = lengthofday;
module.exports.daynight = daynight;
module.exports.closest_stop = closest_stop;
module.exports.Percentage = Percentage;
module.exports.Forest = Forest;
module.exports.fast_enclosing_circle = fast_enclosing_circle;

//------------------------------------------------------------------------------
