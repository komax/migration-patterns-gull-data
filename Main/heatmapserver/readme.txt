Hi,

To run the server which can serve the dynamic heatmaps, you need to first unzip IndividualHeatmaps.zip in this directory.
The zip-file contains files of the heatmaps of individual gulls, which removes the need to re-parse all of the gull file for every heatmap.
Then you just need to execute FlaskRestful.py to start up the server.
You will need (as far as I am aware):
 - flask
 - flask_restful
 - numpy
 - skimage
 - Developed under Python 2.7, not sure about compatability with python 3+

Any questions or problems, contact me.