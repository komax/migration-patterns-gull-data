
function Stream(id, timeline)
{
	this.div = d3.select('#' + id);
	this.svg = this.div.append('svg')
		.attr('width', '100%')
		.attr('height', '100%')
		.datum(this)
	;
	this.timeline = timeline;
	this.resize();
}

Stream.prototype.resize = function resize()
{
	this.width = this.div[0][0].clientWidth;
	this.height = this.div[0][0].clientHeight;
	this.svg
		.attr('viewBox', '0 0 ' + this.width + ' ' + this.height)
	;
	this.scale = this.timeline.scale.copy().range([1, this.width - 2]);
	return this;
}

//------------------------------------------------------------------------------

function TimeStream(id, timeline)
{
	var format = d3.time.format.multi([
		[".%L", function(d) { return d.getMilliseconds(); }],
		[":%S", function(d) { return d.getSeconds(); }],
		["%I:%M", function(d) { return d.getMinutes(); }],
		//["%I %p", function(d) { return d.getHours(); }],
		["%a %d", function(d) { return d.getDay() && d.getDate() != 1; }],
		["%b %d", function(d) { return d.getDate() != 1; }],
		["%b", function(d) { return d.getMonth(); }],
		["%Y", function() { return true; }]
	]);
	this.stream = new Stream(id, timeline);
	this.axis = d3.svg.axis()
		.orient('top')
		.tickFormat(format)
	;
	this.resize();
}

TimeStream.prototype.resize = function resize()
{
	this.stream.resize();
	this.axis.scale(this.stream.scale);
	this.stream.svg.selectAll('*').remove();
	this.stream.svg
		.append('g')
		.attr('class', 'timestream-axis')
		.attr('transform', 'translate(0,' + (this.stream.height - 1) + ')')
		.call(this.axis)
	;
	return this;
}

//------------------------------------------------------------------------------

function AltitudeStream(id, timeline, data)
{
	this.stream = new Stream(id, timeline);
}

//------------------------------------------------------------------------------

function DataStream(id, timeline, data)
{
	this.stream = new Stream(id, timeline);
	var day = 3600 * 24 * 1000;
	this.data = data.map(function (d)
	{
		return { x: d[0], y: (+d[0] % day) / day };
	});
	this.points = this.stream.svg.append('g')
		.attr('class', 'datastream-points')
	;
	this.resize();
}

DataStream.prototype.resize = function resize()
{
	this.stream.resize();
	var points = this.points.selectAll('circle').data(this.data),
		h = this.stream.height,
		s = this.stream.scale;
	points.enter().append('circle').attr('r', 1);
	points
		.attr('cx', function (d) { return s(d.x); })
		.attr('cy', function (d) { return d.y * h; })
	;
	points.exit().remove();
	return this;
}

//------------------------------------------------------------------------------

function MovementStream(id, timeline, data, binsize)
{
	this.stream = new Stream(id, timeline);
	this.binsize = binsize;
	this.data = [];

	// Ignoring the fact that these are lat long coordinates for now...
	var d = +data[0][0] + binsize,
		sum = [0, 0],
		sum2 = [data[0][2], data[0][3]],
		count = 0,
		dist = 0;
	for (var i = 1, time, lat, lon; i < data.length; ++i)
	{
		time = data[i][0];
		lat = data[i][2];
		lon = data[i][3];

		if (+time >= d)
		{
			if (count)
			{
				sum[0] /= count;
				sum[1] /= count;
			}
			var vx = sum2[0] - sum[0],
				vy = sum2[1] - sum[1];
			this.data.push({
				x: time,
				y1: dist,
				y2: Math.sqrt(vx * vx + vy * vy),
			});

			d = +time + binsize;
			sum2 = sum;
			sum = [0,0];
			count = 0;
			dist = 0;
		}
		sum[0] += lat;
		sum[1] += lon;
		++count;
		var vx = lat - data[i-1][2],
			vy = lon - data[i-1][3];
		dist += Math.sqrt(vx * vx + vy * vy);
	}
	this.layer1 = this.stream.svg.append('path')
		.attr('class', 'movementstream-layer1')
	;
	this.layer2 = this.stream.svg.append('path')
		.attr('class', 'movementstream-layer2')
	;
	this.resize();
}

MovementStream.prototype.resize = function resize()
{
	this.stream.resize();
	var h = this.stream.height,
		s = this.stream.scale,
		r = d3.scale.linear()
			.domain(d3.extent(this.data, function (d) { return d.y1 + d.y2; }))
			.range([h, 0]),
		area1 = d3.svg.area()
			.interpolate('cardinal')
			.x(function (d) { return s(d.x); })
			.y0(h)
			.y1(function (d) { return r(d.y1 + d.y2); }),
		area2 = d3.svg.area()
			.interpolate('cardinal')
			.x(function (d) { return s(d.x); })
			.y0(function (d) { return r(d.y1 + d.y2); })
			.y1(function (d) { return r(d.y1); })
		;

	this.layer1.attr('d', area1(this.data));
	this.layer2.attr('d', area2(this.data));
	return this;
}

//------------------------------------------------------------------------------
