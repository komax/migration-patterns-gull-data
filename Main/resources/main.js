/**
 * Global functionality used by the application
 */

(function (global) {

var main = {};

//------------------------------------------------------------------------------

main.initialize = function initialize()
{
	main.organisms = {};
	new Batch()
		.queue(function (next)
		{
			$.ajax({
				url: 'data/organisms.jsonp',
				dataType: 'jsonp',
				scriptCharset: 'utf-8',
				crossDomain: true,
				jsonpCallback: 'organisms',
				success: function (data)
				{
					main.organisms = data;
					for (var id in main.organisms)
						main.organisms[id].id = id;
					next();
				},
			});
		})
		.queue(function (next)
		{
			var ul = d3.select('#global-overview .gull-list'),
				items = ul.selectAll('li')
					.data(d3.values(main.organisms)),
				li = items.enter().append('li')
					.text(function (d) { return d.name; })
					.attr('class', function (d) { return d.sex; })
					.on('click', function (d) { main.selectGulls([d.id]); })
			;
			next();
		})
		.queue(function (next)
		{
			var slider = $('#schema-slider')
				.attr('max', 99)
				.val(78)
				.on('change input', function ()
				{
					Schematic.main.load(slider.val());
				})
			;
			Schematic.main.select.on('select', function (e)
			{
				main.selectNodes(e.target.getFeatures());
			});
			Schematic.main.load(slider.val());
			next();
		})
		.queue(function (next)
		{
			var slider = $('#sat-slider-left')
				.on('change input', function ()
				{
					var opacity = slider.val() / 100.0;
					Maps.layers.mapquestLeft.setVisible(opacity>0);
					Maps.layers.mapquestLeft.setOpacity(opacity);
				})
				.val(0);

			Maps.layers.mapquestLeft.setOpacity(slider.val());
			next();
		})
		.queue(function (next)
		{
			var slider = $('#sat-slider-right')
				.val(0)
				.on('change input', function ()
				{
					var opacity = slider.val() / 100.0;
					Maps.layers.mapquestRight.setVisible(opacity>0);
					Maps.layers.mapquestRight.setOpacity(opacity);
				});

			Maps.layers.mapquestRight.setOpacity(slider.val());
			next();
		})
		.queue(function (next)
		{
			var slider = $('#heatmap-slider')
				.val(100)
				.on('change input', function ()
				{
					var opacity = slider.val() / 100.0;
					Heatmap.main.setOpacity(opacity);
				})
			;
			next();
		})
		.queue(function (next)
		{
			var checkbox = $('#placenames-left')
				.val(false)
				.on('change input', function ()
				{
					Maps.layers.topologyLeft.setVisible(this.checked);
				})
			;
			Maps.layers.topologyLeft.setVisible(this.checked);
			next();
		})
		.queue(function (next)
		{
			var checkbox = $('#placenames-right')
				.val(false)
				.on('change input', function ()
				{
					Maps.layers.topologyRight.setVisible(this.checked);
				})
			;
			Maps.layers.topologyRight.setVisible(this.checked);
			next();
		})
		.go()
	;
}

//------------------------------------------------------------------------------
// Select schema nodes (takes map features)
// Note: this function is used by map interactions;
// this means that calling this function will not update the map itself.

main.selectNodes = function selectNodes(features)
{
	if (!Array.isArray(features))
		features = features.getArray();
	main.getNodeSelection = function () { return features.slice(0); }

	var gulls = new Intersection()
		.addAll(features.map(function (d)
			{ return Object.keys(d.get('events')); }))
		.toArray()
	;
	// Todo: enable this as soon as it exists
	// updateCalendar(features, gulls); 
	main.selectGulls(gulls);
}

main.getNodeSelection = function () { return []; }

//------------------------------------------------------------------------------
// Select gulls by id (takes an array of ids)

main.selectGulls = function selectGulls(selected)
{
	main.getGullSelection = function () { return selected.slice(0); }
	
	var hash = {};
	selected.forEach(function (d) { hash[d] = true; });
	main.inGullSelection = function (arr)
	{
		for (var i = arr.length - 1; i >= 0; --i)
			if (arr[i] in hash)
				return true;
		return false;
	}

	Schematic.main.refresh();

	if (selected.length < 1) // all is deselected
	{
		$('#global-overview').show();
		$('#selection-overview').hide();
		Journey.main.clear();
		Heatmap.main.clear(); // clearing the heatmap shows the default one
	}
	else
	{
		$('#global-overview').hide();
		$('#selection-overview').show();

		if (selected.length == 1){
			Journey.main.load(selected[0]);
			// Heatmap of a single gull is not very useful, since the trajectory is shown.
			Heatmap.main.clear(); 
		}
		else {
			Journey.main.clear();
			Heatmap.main.load(selected);
		}
	}
}

main.getGullSelection = function () { return []; }
main.inGullSelection = function () { return false; }

main.intersectGullSelection = function intersectGullSelection(gulls)
{
	main.selectGulls(new Intersection()
		.add(main.getGullSelection())
		.add(gulls)
		.toArray());
}

//------------------------------------------------------------------------------

function Batch()
{
	this.list = [];
}

Batch.prototype.queue = function queue(func)
{
	this.list.push(func);
	return this;
}

Batch.prototype.go = function go()
{
	var self = this;
	function next()
	{
		var func = self.list.shift();
		if (func)
			return func(next);
	}
	next();
	return this;
}

//------------------------------------------------------------------------------

function Intersection()
{
	var elements = undefined;
	function add(arr)
	{
		if (elements)
			elements = elements.filter(function (x)
				{ return arr.indexOf(x) >= 0; });
		else
			elements = arr.slice(0);
		return this;
	}
	function addAll(arrs)
	{
		for (var i = arrs.length - 1; i >= 0; --i)
			add(arrs[i]);
		return this;
	}
	function toArray()
	{
		return (elements || []).slice(0);
	}
	this.add = add;
	this.addAll = addAll;
	this.toArray = toArray;
}

//------------------------------------------------------------------------------

global.Main = main;
global.Batch = Batch;
global.Intersection = Intersection;

})(window || this);

//------------------------------------------------------------------------------
