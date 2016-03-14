
var triangulate = require("delaunay-triangulate"),
	utils = require('./utils.js');

//------------------------------------------------------------------------------
// Function that clusters using Kruskal's algorithm on a delaunay triangulation
// Uses a distance function to weigh edges
// Input array is destroyed
// Output is a tree where leafs are coords and nodes are [left, right, dist]

function cluster(coords, distfunc)
{
	var tri = triangulate(coords),
		edges = [],
		forest = new utils.Forest(coords.length),
		forest2 = [],
		tree = undefined;
	coords.length = 0;

	for (var i = tri.length - 1; i >= 0; --i)
	{
		var t = tri[i];
		if (t[1] > t[0]) edges.push([t[0], t[1], distfunc(t[0], t[1])]);
		if (t[2] > t[1]) edges.push([t[1], t[2], distfunc(t[1], t[2])]);
		if (t[0] > t[2]) edges.push([t[2], t[0], distfunc(t[2], t[0])]);
	}
	edges.sort(function (a, b) { return b[2] - a[2]; });
	tri = null;

	var status = new utils.Percentage(edges.length),
		depth = 0;
	while (edges.length)
	{
		var edge = edges.pop(),
			u = forest.find(edge[0]),
			v = forest.find(edge[1]);
		if (forest.union(u, v))
		{
			tree = forest2[u] = [
				forest2[u] || edge[0],
				forest2[v] || edge[1],
				edge[2],
				depth++
			];
			if (v in forest2)
				delete forest2[v];
		}
		status.increase();
	}
	status.done();
	forest = null;
	forest2.length = 0;

	return tree;
}

//------------------------------------------------------------------------------

module.exports = cluster;

//------------------------------------------------------------------------------
