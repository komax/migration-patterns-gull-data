var fs = require('fs'),
	lr = require('line-reader'),
	args = require('minimist')(process.argv.slice(2)),
	input = args._[0],
	input2 = args._[1],
	output = args.o || args.output,
	data = {},
	data2 = {};

if (args._.length < 1)
{
	console.log('Usage:\n\t' + process.argv.slice(0, 2).join (' ') + ' [-o filename] <data file> [organism file]')
	process.exit();
}
if (!output)
	output = input.replace(/(\.[^.]+)?$/, '.json');

if (input2)
	ParseOrganism.bind(this, input2,
		ParseData.bind(this, input,
			WriteData.bind(this, output)))();
else
	ParseData.bind(this, input,
		WriteData.bind(this, output))();

function ParseOrganism(input, then)
{
	var header;
	lr.eachLine(input, function (line)
	{
		var row = line.split('\t'),
			id = row.shift();
		if (!header)
		{
			header = row;
			return;
		}

		data2[id] = data2[id] || {};
		for (var i = 0, l = row.length; i < l; ++i)
			data2[id][header[i]] = Normalize(row[i]);
	}, then);
}

function ParseData(input, then)
{
	var header;
	lr.eachLine(input, function (line)
	{
		var row = line.split('\t'),
			id = row.shift();
		if (!header)
		{
			header = row;
			return;
		}

		data[id] = data[id] || data2[id] || {};
		for (var i = 0, l = row.length; i < l; ++i)
		{
			data[id][header[i]] = data[id][header[i]] || [];
			data[id][header[i]].push(Normalize(row[i]));
		}
	}, then);	
}

function WriteData(output)
{
	fs.writeFileSync(output, JSON.stringify(data));
}

function Normalize(value)
{
	if (''+(+value) == value)
		return +value;
	else if (''+!!value == value)
		return !!value;
	else if (/^\d+-\d+-\d+T\d+:\d+:\d+/.test(value))
		return +(new Date(value));
	return value;
}