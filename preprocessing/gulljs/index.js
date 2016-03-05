#!/usr/bin/env node

if (process.argv.length < 3)
{
	console.log('Usage:\n\tgulljs <command> ...\n\n'+
		'Commands:\n\tconvert\t\tconverts csv file to json\n\t'+
		'process\t\tprocesses json file for use with client');
}
else
{
	var cmd = process.argv[2];
	process.argv[0] = 'gulljs';
	process.argv.splice(1, 2, '');
	switch (cmd)
	{
		case 'convert': require('./data2json.js'); break;
		case 'process': require('./process.js'); break;
		default: console.log('undefined command: ' + cmd); break;
	}
}