
var utils = require('./utils.js');

//------------------------------------------------------------------------------
// Function that clusters coordinates by chaining
// Input array is destroyed

function cluster(coords, distance)
{
	var count = coords.length,
		forest = new Forest(count),
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
		var cluster = hash[x],
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
			dist = Math.max(dist, utils.distance(
				lat, lon, cluster[j][0], cluster[j][1]));
		clusters.push({
			center: [lat, lon],
			radius: dist,
			coords: cluster,
		});
	}

	return clusters;
}

//------------------------------------------------------------------------------
// Union-find data structure with path compression fro effective set-union

function Forest(range)
{
	this.clusters = Array(range);
}

Forest.prototype.find = function (a)
{
	var parent = this.clusters;
	if (!parent[a])
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
}

//------------------------------------------------------------------------------

module.exports = cluster;

//------------------------------------------------------------------------------
