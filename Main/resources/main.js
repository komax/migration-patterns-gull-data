/**
 * Global functionality used by the application
 */

(function (global) {

var main = {};

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
					.on('click', function (d) { main.updateSelection([d.id]); })
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
				main.updateSelection(getIds(e.target.getFeatures()));
			});
			Schematic.main.load(slider.val());
			next();
		})
		.go()
	;
}

//------------------------------------------------------------------------------

function getIds(features)
{
	if (!Array.isArray(features))
		features = features.getArray();
	var ids = {};
	features.forEach(function (d)
	{
		var events = d.get('events');
		for (var id in events)
			ids[id] = true;
	});
	return Object.keys(ids);
}

//------------------------------------------------------------------------------

main.updateSelection = function updateSelection(selected)
{
	if (selected.length < 1) // all is deselected
	{
		$('#global-overview').show();
		$('#selection-overview').hide();
		Journey.main.clear();
		Heatmap.main.clear();
	}
	else
	{
		$('#global-overview').hide();
		$('#selection-overview').show();
		
		Heatmap.main.load(selected);

		if (selected.length == 1)
			Journey.main.load(selected[0]);
		else
			Journey.main.clear();
	}
}

//------------------------------------------------------------------------------

global.Main = main;

})(window || this);

//------------------------------------------------------------------------------
