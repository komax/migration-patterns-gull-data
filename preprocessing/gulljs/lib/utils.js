
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

module.exports.distance = distance;
module.exports.timeofday = timeofday;
module.exports.lengthofday = lengthofday;
module.exports.daynight = daynight;
module.exports.closest_stop = closest_stop;

//------------------------------------------------------------------------------
