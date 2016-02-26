function Timeline(scale)
{
	this.scale = scale || d3.time.scale.utc().domain([new Date(0), new Date]);
	this.time = this.scale.domain()[0];
	this.speed = 0;

	var dispatch = d3.dispatch('update');
	this.on = dispatch.on.bind(dispatch);
	this.on.dispatch = dispatch;
}

Timeline.prototype.update = function update()
{
	this.on.dispatch.update(this.time);
	return this;
}

Timeline.prototype.to = function to(time)
{
	this.time = time;
	return this.update();
}

Timeline.prototype.play = function play()
{
	if (this.interval) return;
	var self = this;
	this.interval = setInterval(function ()
	{
		self.time = new Date(+self.time + self.speed);
		self.update();
	}, 1000 / 60);
}

Timeline.prototype.pause = function pause()
{
	if (!this.interval) return;
	clearInterval(this.interval);
	delete this.interval;
}