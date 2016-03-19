/**
 * Initialization of the interface
 */

(function (global) { $(function () {

//------------------------------------------------------------------------------

$('header h1').text(document.title);

$('#pane').resizable({
	axis: 'y',
	handles: { n: $('#vdivider') },
	resize: function ()
	{
		if ($(this).height() <= 32)
			$(this).height(0);
		Maps.resize();
	},
});
$('#left-view').resizable({
	axis: 'x',
	handles: { e: $('#hdivider') },
	resize: function () { Maps.resize() },
});

//------------------------------------------------------------------------------

window.interface = {}
window.interface.expandControl = function(expandElement, collapseElement, expandCharacter, collapseCharacter)
{
	var button = document.createElement('button');
	button.innerHTML = expandCharacter;
	var viewIsExpanded = false;

	var collapseToggle = function ()
	{
		// By only setting the left view, we automatically also collapse or 
		// expand the right-view as they take up 100% width together (minus the hdivider)
		if(viewIsExpanded) {
			$(collapseElement).css('width', 'calc(50% - .5em)');
			$(expandElement).css('width', 'calc(50% - .5em)');
			button.innerHTML = expandCharacter;
		}
		else {
			$(collapseElement).css('width', 0);
			$(expandElement).css('width', '100%');
			button.innerHTML = collapseCharacter;
		}

		viewIsExpanded = !viewIsExpanded;
		Maps.resize();
	}

	button.addEventListener('click', collapseToggle, false);
	button.addEventListener('touchstart', collapseToggle, false);

	var element = document.createElement('div');
	element.className = 'expand-view ol-unselectable ol-control';
	element.appendChild(button);

	ol.control.Control.call(this, {
	  element: element
	});
};

ol.inherits(window.interface.expandControl, ol.control.Control);

//------------------------------------------------------------------------------

window.interface.paneControl = function(paneElement, defaultHeight, expandCharacter, collapseCharacter)
{
	var button = $('<button>').text(expandCharacter),
		paneIsExpanded = false;

	button.on('click touchstart', function collapseToggle()
	{
		if (paneIsExpanded)
		{
			$(paneElement).height(0);
			button.text(expandCharacter);
		}
		else
		{
			$(paneElement).height(defaultHeight);
			button.text(collapseCharacter);
		}

		paneIsExpanded = !paneIsExpanded;
		Maps.resize();
	});

	ol.control.Control.call(this, {
		element: $('<div>')
			.attr('class', 'expand-pane ol-unselectable ol-control')
			.append(button)[0],
	});
}

ol.inherits(window.interface.paneControl, ol.control.Control);

//------------------------------------------------------------------------------

}); })(window || this);

//------------------------------------------------------------------------------