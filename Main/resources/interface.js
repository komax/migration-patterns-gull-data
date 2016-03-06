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

}); })(window || this);

//------------------------------------------------------------------------------
