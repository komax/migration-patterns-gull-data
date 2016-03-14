Number.prototype.toRadians = function()
{
	return this*(Math.PI/180.0);
};

// Calculates the distance in metres between points p1 and p2
// where p1 and p2 are arrays with [lon, lat]
// For the calculations, the Haversine formula is used:
// http://www.movable-type.co.uk/scripts/latlong.html
function distanceBetweenPoints(p1, p2)
{
	var R = 6371000; // metres

	var phi1 = p1[1].toRadians();
	var phi2 = p2[1].toRadians();
	var dPhi = (p2[1]-p1[1]).toRadians();
	var dLambda = (p2[0]-p1[0]).toRadians();

	var a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
	        Math.cos(phi1) * Math.cos(phi2) *
	        Math.sin(dLambda/2) * Math.sin(dLambda/2);

	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	var d = R * c;

	return d;
}

// Frechet Distance calculation from Assignment 1
// this allows some of the coastline to be skipped.
function leapingFrechetDistance(tr1, tr2, epsilon)
{
	var m = tr1.length,
		i = 0,
		n = tr2.length,
		j = 0;
	var matches = [];

	while(j < n)
	{
		while(i<m && distanceBetweenPoints(tr1[i],tr2[j]) <= epsilon)
		{
			matches.push([tr1[i], tr2[j]]);
			i += 1;
		}
		j += 1;
	}
	if(i == m)
		return matches;
	else
		return;
}