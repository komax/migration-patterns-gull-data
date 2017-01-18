# Visual Analytics for Migration Patterns #
This visualization framework for movement data identifies stopovers. The summarized stopovers are used to select and investigate migration strategy. The density map shows the spatial widespread of movements on top of a geographical map.

### Dependencies ###
* d3
* jquery 2.2.1
* openlayers v3.19.1
* tooltipster
* javascript
* python 2.7

### Computation of the stopover aggregation  ###
0. Change directory to preprocessing:
```
$ cd preprocessing/gulljs/
```
1. Conversion of the data files to json:
```
$ node index.js convert lesser_black_gulls.txt organism.txt -o lesser_black_gulls.json
```
2. Computing the stopover aggregation on all scales and save it in `gulldata.json`:
```
$ node index.js process lesser_black_gulls.json gulldata.json --depth=100
```
3. Extracting the results as geojsonp files:
```
$ node index.js extract gulldata.json .
```
4. Deleting temporary files: `gulldata.json` and `lesser_black_gulls.json`.

### List of shortcuts ###
1. List of gulls:
```
Ctrl + click: Add entity to the selection.
Pressing ESC: Undo the current selection of entities.
Hover: Shows the trajectory on top of the density map.
Alt + hover: Pin the hovered trajectory, such that it won't disappear.
Pressing t: Toggles the text labels of the stopovers along the trajectory.
```
2. Stopover aggregation:
```
Hover: Shows the distribution of genders at the stopover.
Click: Selects or deselects a stopover.
Ctrl + click: Enters a stopover as the new destination (the old destination becomes an intermediate destination).
```
3. Calendar view:
```
Pressing space: Toggles between showing the whole distribution of stopovers over time or only at the selected stopovers.
Shift + click: Selects a start or end date for restricting the time range at the selected stopovers.
Pressing delete: Undo the selected time frame.
```


### Tutorial to learn Markdown ###
* [Learn Markdown](https://bitbucket.org/tutorials/markdowndemo)
