
var utils = require('./utils.js');

//------------------------------------------------------------------------------
// Function that clusters coordinates by chaining
// Input array is destroyed

function cluster(coords, distance)
{
	var count = coords.length,
		forest = new utils.Forest(count),
		hash = {},
		clusters = [];

	// Sort points on lattitude
	coords.sort(function (a, b) { return a[0] - b[0]; });

	// clustering on distance disks, uses fact that points are sorted on lattitude
	for (var i = 0, top = 0; i < count; ++i)
	{
		while ((top + 1 < count) && utils.distance(
				coords[top + 1][0], 0,
				coords[i][0], 0) <= distance)
			++top;

		for (var j = i + 1; j <= top; ++j)
			if (utils.distance(
					coords[i][0], coords[i][1],
					coords[j][0], coords[j][1]) <= distance)
				forest.union(i, j);
	}

	// group coords according the clustering
	for (var i = count - 1; i >= 0; --i)
	{
		var j = forest.find(i);
		if (!(j in hash))
			hash[j] = [coords[i]];
		else
			hash[j].push(coords[i]);
	}
	coords.length = 0;
	forest = null;

	// process clusters
	for (var x in hash)
	{
		var cluster = utils.fast_enclosing_circle(hash[x]);
		cluster.coords = hash[x];
		clusters.push(cluster);
	}

	return clusters;
}

//------------------------------------------------------------------------------

module.exports = cluster;

//------------------------------------------------------------------------------
