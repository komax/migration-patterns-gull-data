function CatmullRom(p0, p1, p2, p3, t)
{
	var t2 = t * t,
		t3 = t2 * t;
	function f(p0, p1, p2, p3)
	{
		return .5 *
			( p0 * (-t3 + 2 * t2 - t)
			+ p1 * (3 * t3 - 5 * t2 + 2)
			+ p2 * (-3 * t3 + 4 * t2 + t)
			+ p3 * (t3 - t2));
	}
	return [
		f(p0[0], p1[0], p2[0], p3[0]),
		f(p0[1], p1[1], p2[1], p3[1]),
	];
}

function BarryGoldman(p0, p1, p2, p3, t, a)
{
	a = a || .25;
	var d1 = Math.pow(dist(p0, p1), a) || 1,
		d2 = Math.pow(dist(p1, p2), a) || 1,
		d3 = Math.pow(dist(p2, p3), a) || 1;
		d12 = d1 + d2,
		d23 = d2 + d3,
		t0 = -t * d2 - d1,
		t1 = d1 + t0,
		t2 = d2 + t1,
		t3 = d3 + t2;
	function f(p0, p1, p2, p3)
	{
		var a1 = t1 / d1 * p0 - t0 / d1 * p1,
			a2 = t2 / d2 * p1 - t1 / d2 * p2,
			a3 = t3 / d3 * p2 - t2 / d3 * p3,
			b1 = t2 / d12 * a1 - t0 / d12 * a2,
			b2 = t3 / d23 * a2 - t1 / d23 * a3;
		return t2 / d2 * b1 - t1 / d2 * b2;
	}
	return [
		f(p0[0], p1[0], p2[0], p3[0]),
		f(p0[1], p1[1], p2[1], p3[1]),
	];
}

function dist(p0, p1)
{
	var vx = p1[0] - p0[0],
		vy = p1[1] - p1[1];
	return Math.sqrt(vx * vx + vy * vy);
}

function findZ(p0, p1, p2)
{
	var vx = p1[0] - p0[0],
		vy = p1[1] - p0[1],
		rx = p0[0] - p2[0],
		ry = p0[1] - p2[1];
		b = Math.sqrt(vx * vx + vy * vy)
		h = Math.abs(vx * ry - vy * rx) / b;
	return .5 * Math.abs(vx * ry - vy * rx);
}

function applyZ(points)
{
	points[0][2] = Infinity;
	points[points.length - 1][2] = Infinity;
	for (var i = 1, l = points.length - 1; i < l; ++i)
		points[i][2] = findZ(points[i - 1], points[i], points[i + 1]);
}

function interpolate(data, count, func)
{
	var points = [data[0]];
	for (var i = 1, l = data.length - 1; i < l; ++i)
	{
		points.push(data[i]);
		var p0 = data[Math.max(i - 1, 0)],
			p1 = data[i],
			p2 = data[i + 1],
			p3 = data[Math.min(i + 2, l - 1)];
		for (var j = 0; j < count; ++j)
		{
			var p = func(p0, p1, p2, p3, j / count);
			if (!Number.isNaN(p[0]) && !Number.isNaN(p[1]))
				points.push(p);
			else
				console.log(p0, p1, p2, p3);
		}
	}
	points.push(data[data.length - 1]);
	return points;
}

function simplify(data, count) // Visvalingam, O(n^2) for now
{
	applyZ(data);
	var points = data.slice(0);
	while (points.length > count)
	{
		var j = 0, min = Infinity;
		for (var i = points.length - 1; i >= 0; --i)
		{
			if (points[i][2] >= min)
				continue;
			min = points[i][2];
			j = i;
		}
		points.splice(j, 1);
		if (points[j][2] != Infinity)
			points[j][2] = findZ(points[j - 1], points[j], points[j + 1]);
		if (points[j + 1] && points[j + 1][2] != Infinity)
			points[j + 1][2] = findZ(points[j], points[j + 1], points[j + 2]);
	}
	return points;
}
