/**
 * Initialization of the interface
 */

(function (global) { $(function () {

//------------------------------------------------------------------------------

$('header h1').text(document.title);

$('#pane').resizable({
	axis: 'y',
	handles: { n: $('#vdivider') },
	resize: function() { Maps.resize() },
});
$('#left-view').resizable({
	axis: 'x',
	handles: { e: $('#hdivider') },
	resize: function() { Maps.resize() },
});

//------------------------------------------------------------------------------
window.interface = {}
window.interface.expandControl = function(id) {

    var button = document.createElement('button');
    button.innerHTML = 'E';
    var viewIsExpanded = false;

    var collapseToggle = function (){
    	// By only setting the left view, we automatically also collapse or 
    	// expand the right-view as they take up 100% width together (minus the hdivider)
    	if(viewIsExpanded) {
			$('#left-view').css('width', 'calc(50% - .5em)');
    		button.innerHTML = 'E';
    	}
    	else {
			$(id).css('width', 0);
    		button.innerHTML = 'C';
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

}); })(window || this);

//------------------------------------------------------------------------------