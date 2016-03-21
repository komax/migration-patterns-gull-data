import pickle
import os
import StringIO
from collections import OrderedDict, defaultdict
import numpy as np
from pyproj import Proj, transform
from skimage.measure import find_contours
from skimage.measure import points_in_poly
from preprocess_heatmap import generate_heatmap, generate_heatmap_for_gulls

def FindNextStartEnd(contours, lookfrom, xmax, ymax, start, counter = 0):
	"""
	 (0,0)----<-----(xmax,0)
	   |				|
	   v				|
	   |				^
	   |				|
	 (0, ymax)-->---(xmax, ymax)

	 We aim to find the next contour start or end looking in a clockwise direction
	 from lookfrom (lookfrom should be on a border)
	 Very naive way, as we expect a very small amount of contours to actually touch the edges.
	"""
	determine_idx = lambda x: 0 if start else len(x)-1
	if(counter == 5):
		# Walked along all edges and did not find another end/start 
		# This should only be possible if there are no contours touching an edge
		return None, None

	# Can probably find a way to simplify the cases into one case (with some multiplication and such)
	# but I have too much of a headache to figure that out right now
	if(lookfrom[0] == 0 and lookfrom[1] < ymax):
		# We look along (0,)
		min_contour = None
		min_idx = 0
		min_n = 0
		for n, contour in enumerate(contours):
			idx = determine_idx(contour)
			if(contour[idx][0] == 0 and lookfrom[1] < contour[idx][1]
			   and (min_contour is None or contour[idx][1] < min_contour[min_idx][1])):
				min_contour = contour
				min_idx = idx
				min_n = n
		if(min_contour is not None):
			return min_contour, min_n
		else:
			return FindNextStartEnd(contours, [0, ymax], xmax, ymax, start, counter + 1)

	if(lookfrom[0] < xmax and lookfrom[1] == ymax):
		# We look along (,ymax)
		min_contour = None
		for n, contour in enumerate(contours):
			idx = determine_idx(contour)
			if(contour[idx][1] == ymax and lookfrom[0] < contour[idx][0]
			   and (min_contour is None or contour[idx][0] < min_contour[min_idx][0])):
				min_contour = contour
				min_idx = idx
				min_n = n
		if(min_contour is not None):
			return min_contour, min_n
		else:
			return FindNextStartEnd(contours, [xmax, ymax], xmax, ymax, start, counter + 1)

	if(lookfrom[0] == xmax and lookfrom[1] > 0):
		# We look along (xmax,)
		min_contour = None
		for n, contour in enumerate(contours):
			idx = determine_idx(contour)
			if(contour[idx][0] == xmax and lookfrom[1] > contour[idx][1]
			   and (min_contour is None or contour[idx][1] > min_contour[min_idx][1])):
				min_contour = contour
				min_idx = idx
				min_n = n
		if(min_contour is not None):
			return min_contour, min_n
		else:
			return FindNextStartEnd(contours, [xmax, 0], xmax, ymax, start, counter + 1)

	if(lookfrom[0] > 0  and lookfrom[1] == 0):
		# We look along (,0)
		min_contour = None
		for n, contour in enumerate(contours):
			idx = determine_idx(contour)
			if(contour[idx][1] == 0 and lookfrom[0] > contour[idx][0]
			   and (min_contour is None or contour[idx][0] > min_contour[min_idx][0])):
				min_contour = contour
				min_idx = idx
				min_n = n
		if(min_contour is not None):
			return min_contour, min_n
		else:
			return FindNextStartEnd(contours, [0, 0], xmax, ymax, start, counter + 1)

def FindContourLoop(contours, lon_bins, lat_bins):	
	contour, n = FindNextStartEnd(contours, [0,0], lon_bins-1, lat_bins-1, start=False)
	loop_complete = contour is None
	if(loop_complete):
		return None, None

	firststart = contour[0]
	lastcoord = contour[len(contour)-1]
	new_contours = [contour]
	used_contours = [n]
	while(not loop_complete):
		new_contour, n = FindNextStartEnd(contours, lastcoord, lon_bins-1, lat_bins-1, start=True)
		if(new_contour[0][0] == firststart[0] and new_contour[0][1] == firststart[1]):
			loop_complete = True
			new_contours.append([firststart])
		else:
			new_contours.append(new_contour)
			used_contours.append(n)
			lastcoord = new_contour[len(new_contour)-1]
	return new_contours, used_contours

def DeleteFromList(lst, indices):
	indices.sort()
	indices.reverse()
	for idx in indices:
		del lst[idx]
		
def findOrdering(polyorder, toorder):
	orderedList = sorted(toorder, key=lambda x: -len(polyorder[x]))

	ordering = []
	filteredList = [n for n in orderedList]
	while(len(filteredList)>0):
		first = filteredList[0]
		del filteredList[0]
		filteredList = [n for n in filteredList if n not in polyorder[first]]
		innerorderedList = sorted(polyorder[first], key=lambda x: -len(polyorder[x]))
		innerfilteredList = []
		secondlevel = []
		while(len(innerorderedList)>0):
			innerfirst = innerorderedList[0]
			secondlevel.append(innerfirst)
			del innerorderedList[0]
			innerfilteredList = [n for n in innerorderedList if n not in polyorder[innerfirst]]	
			ordering += findOrdering(polyorder, polyorder[innerfirst])
		ordering.append([first, secondlevel])
	return ordering

def WriteOrderingToFile(ordering, polygons, fh, min_lon, min_lat, lon_bin_size, lat_bin_size):
	print('Writing to file')
	inProj = Proj(init='epsg:4326')
	outProj = Proj(init='epsg:3857')

	fh.write('{\n')
	fh.write('\t\'type\': \'FeatureCollection\',\n')
	fh.write('\t\'crs\': {\n')
	fh.write('\t\t\'type\':\'name\',\n')
	fh.write('\t\t\'properties\': {\'name\':\'EPSG:3857\'}\n')
	fh.write('\t},\n')
	fh.write('\t\'features\': [\n')	
	for n, pairing in enumerate(ordering):	
		if(pairing == []): continue	

		fh.write('\t\t{\n')
		fh.write('\t\t\t\'type\': \'feature\',\n')
		fh.write('\t\t\t\'geometry\': {\n')
		fh.write('\t\t\t\t\'type\': \'Polygon\',\n')
		fh.write('\t\t\t\t\'coordinates\': [\n')
		for i in [pairing[0]]+pairing[1]:
			fh.write('\t\t\t\t\t[')
			contour = polygons[i]
			for vertex in contour:
				lon = vertex[0]*lon_bin_size + min_lon #(lon_bin_size / 2) +
				lat = vertex[1]*lat_bin_size + min_lat #(lat_bin_size / 2) + 
				x,y = transform(inProj,outProj,lon,lat)
				fh.write('[%f,%f],'%(x, y))
			fh.write('\t\t\t\t\t],\n')

		fh.write(']\n')		
		fh.write('\t\t\t}\n')
		fh.write('\t\t},\n')

	fh.write('\t]\n')
	fh.write('}\n')


def contourizeHeatmapFromFile(filein, fileout, source, contourlevel):
	if(os.path.isfile(filein)):
		with open(filein, 'rb') as fh:
			heatmap_info = pickle.load(fh)
	else:
		heatmap_info = generate_heatmap(source, filein, 400, 800)	
	contourizeHeatmap(heatmap_info, fileout, contourlevel)

def contourizeHeatmap(heatmap_info, fileout, contourlevel):
	[normalized_heatmap, min_lon, max_lon, min_lat, max_lat, lon_bins, lat_bins] = heatmap_info	

	lon_bin_size = (max_lon - min_lon) / lon_bins
	lat_bin_size = (max_lat - min_lat) / lat_bins

	contours = find_contours(normalized_heatmap, contourlevel)#
	del normalized_heatmap

	# http://scikit-image.org/docs/dev/api/skimage.measure.html#skimage.measure.find_contours
	# Output contours are not guaranteed to be closed: contours which intersect the array edge will be left open.
	# All other contours will be closed. 
	# (The closed-ness of a contours can be tested by checking whether the beginning point is the same as the end point.)
	# So, we need to find the contours which belong together
	nonclosed = []
	interiors = []
	exteriors = []
	closed=[]
	for n, contour in enumerate(contours):
		startDiffersFromEnd = (contour[len(contour)-1][0] != contour[0][0] or contour[len(contour)-1][1] != contour[0][1])
		startAtBorder = (contour[0][0] == 0 or contour[0][1] == 0 or contour[0][0] == lon_bins-1 or contour[0][1] == lat_bins-1)
		last = len(contour)-1
		endAtBorder = (contour[last][0] == 0 or contour[last][1] == 0 or contour[last][0] == lon_bins-1 or contour[last][1] == lat_bins-1)
		if(startDiffersFromEnd and startAtBorder and endAtBorder):
			nonclosed.append(contour)
		else:
			closed.append(contour)

	contour_loop, used_contours =  FindContourLoop(nonclosed, lon_bins, lat_bins)
	while(contour_loop is not None):
		DeleteFromList(nonclosed, used_contours)
		closed.append(np.concatenate(contour_loop))
		if(len(nonclosed)>0):
			contour_loop, used_contours = FindContourLoop(nonclosed, lon_bins, lat_bins)
		else:
			break

	polyorder = defaultdict(lambda : [])
	outermost = [True]*len(closed)
	for n, poly1 in enumerate(closed):
		for m, poly2 in enumerate(closed):
			if(n!=m and all(points_in_poly(poly1, poly2))):
				polyorder[m].append(n)
				outermost[n] = False
				break

	final_ordering = findOrdering(polyorder, range(len(closed)))
	WriteOrderingToFile(final_ordering, closed, fileout, min_lon, min_lat, lon_bin_size, lat_bin_size)


def generate_contours_for_gulls(gulls):
	heatmap_info= generate_heatmap_for_gulls(gulls)
	output = StringIO.StringIO()
	output.write('{\n')
	for i in range(1, 6):		
		output.write('contour%i : \n'%(i))
		contourizeHeatmap(heatmap_info, output, i)		
		output.write(',\n')

	output.write('}')
	return output.getvalue()

"""
#======================================================================================================================
output_file = 'heatmap_contours.js' # This will be the name of the output file
heatmap_file = 'heatmap.pkl'		# This is the file where the intermediate heatmap will be loaded from,
									# if it does not exist, it will generate the heatmap and store it there.
gull_source = 'lesser_black_gulls.txt' # If it needs to re-generate the heatmap, it will use this data.

with open(output_file, 'w') as fh:
	fh.write('var contours = {\n')
	for i in range(1, 6):		
		fh.write('contour%i : \n'%(i))
		contourizeHeatmap(heatmap_file, fh, gull_source, i)		
		fh.write(',\n')

	fh.write('};')
"""