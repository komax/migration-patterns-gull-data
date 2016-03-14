import numpy as np
import math
import os
import datetime
from datetime import timedelta as timedelta
from collections import OrderedDict, defaultdict
from skimage.measure import find_contours
from skimage.measure import points_in_poly
import matplotlib.pyplot as plt
from pyproj import Proj, transform
import pickle


def normalize_heatmap(heatmap, valuebins, lons, lats):
	print('start normalizing')
	normalized_hm = np.zeros([lons, lats])
	factor = 10.0/len(valuebins)
	for i in heatmap:
		for j in heatmap[i]:
			for b in range(1,len(valuebins)+1):
				if(heatmap[i][j]<= valuebins[b-1]):
					normalized_hm[i,j] = 1+b#*factor
					break;
	print('stop normalizing')
	return normalized_hm

def write_placemark(point, magnitude, fh):
	point_as_string = "%f,%f,0"%(point[0],point[1])
	fh.write('\t\t\t<Placemark>\n')
	fh.write('\t\t\t\t<name>'+str(magnitude)+'</name>\n')
	fh.write('\t\t\t\t<Point>\n\t\t\t\t\t<coordinates>'+point_as_string+'</coordinates>\n\t\t\t\t</Point>\n')
	fh.write('\t\t\t</Placemark>\n')

def read_data_by_gull(filepath):
	with open(filepath, 'r') as fh:
		columns = fh.readline()
		last_gull = None
		gull_data = {}
		min_lon = float("inf")
		max_lon = float("-inf")
		min_lat = float("inf")
		max_lat = float("-inf")

		while(True):
			try:
				gull, time_str, _, lat_str, lon_str, _, _ = fh.readline()[:-1].split('\t')
				if gull != last_gull or last_gull is None:
					print(gull)
					gull_data[gull] = []
					last_gull = gull					

				lat = float(lat_str)
				lon = float(lon_str)
				#if(35.5<lat and lat < 44 and -10.3<lon and lon<4): # Spain
				time = datetime.datetime(int(time_str[0:4]), int(time_str[5:7]), int(time_str[8:10]), int(time_str[11:13]), int(time_str[14:16]), int(time_str[17:19]))
				gull_data[gull].append([lon, lat, time])
				if(lat<30 and lon > 0):
					print(gull+time_str+"(%s,%s)"%(lon_str, lat_str))

				if(lat < min_lat):
					min_lat = lat
				if(lat > max_lat):
					max_lat = lat
				if(lon < min_lon):
					min_lon = lon
				if(lon > max_lon):
					max_lon = lon
			except ValueError:
				break;

		return gull_data, min_lon, max_lon, min_lat, max_lat

def interpolate_position(ob1, ob2, time):
	sec_per_day = 24*60*60
	seconds_between_obs = (ob2[2] - ob1[2]).days*sec_per_day + (ob2[2] - ob1[2]).seconds
	seconds_between_ob_time = (time - ob1[2]) .days*sec_per_day + (time - ob1[2]).seconds
	alpha = seconds_between_ob_time/ seconds_between_obs
	inter_lon = ob1[0] + (ob2[0] - ob2[0])* alpha
	inter_lat = ob1[1] + (ob2[1] - ob2[1])* alpha
	return inter_lon, inter_lat

def WriteContoursToFile(path, contours):
	print('Writing to file')

	inProj = Proj(init='epsg:4326')
	outProj = Proj(init='epsg:3857')
	with open('gull_heatmap.js', 'w') as fh:
		fh.write('var contours = {\n')
		fh.write('\t\'type\': \'FeatureCollection\',\n')
		fh.write('\t\'crs\': {\n')
		fh.write('\t\t\'type\':\'name\',\n')
		fh.write('\t\t\'properties\': {\'name\':\'EPSG:3857\'}\n')
		fh.write('\t},\n')
		fh.write('\t\'features\': [\n')	
		for n, contour in enumerate(contours):		
			fh.write('\t\t{\n')
			fh.write('\t\t\t\'type\': \'feature\',\n')
			fh.write('\t\t\t\'geometry\': {\n')
			fh.write('\t\t\t\t\'type\': \'Polygon\',\n')
			fh.write('\t\t\t\t\'coordinates\': [[')
			for i in range(len(contour)):
				lon = contour[i][0]*lon_bin_size + min_lon #(lon_bin_size / 2) +
				lat = contour[i][1]*lat_bin_size + min_lat #(lat_bin_size / 2) + 
				x,y = transform(inProj,outProj,lon,lat)
				fh.write('[%f,%f],'%(x, y))

			fh.write(']]\n')		
			fh.write('\t\t\t}\n')
			fh.write('\t\t},\n')

		fh.write('\t]\n')
		fh.write('}\n')

def FillHeatmap(gull_data, heatmap, sampletime =15):
	print('Filling heatmap')	
	for gull in gull_data:
		last_observation = None
		last_sample_time = datetime.datetime.min
		for observation in gull_data[gull]:
			# if no observations have been made, start sampling at this time.
			if(last_observation is None):
				lon = observation[0]
				lat = observation[1]
				last_sample_time = observation[2]
				
			sample_interval = timedelta(minutes=sampletime)
			observation_time = observation[2]
			# We want samples every 15 minutes, so we interpolate if needed.
			if(last_sample_time +  sample_interval <= observation_time):
				lon, lat = interpolate_position(last_observation, observation, last_sample_time + sample_interval)
				last_sample_time = last_sample_time + sample_interval

			# If a sample is collected, add it to the heatmap.
			if(last_observation is None or (last_sample_time + sample_interval <= observation_time)):
				lat_bin = math.ceil((lat - min_lat)/lat_bin_size)-1
				lon_bin = math.ceil((lon - min_lon)/lon_bin_size)-1
				heatmap[lon_bin][lat_bin] += 2
				heatmap[max(lon_bin-1,0)][lat_bin] += 1
				heatmap[min(lon_bin+1,lon_bins-1)][lat_bin] += 1
				heatmap[lon_bin][max(lat_bin-1,0)] += 1
				heatmap[lon_bin][min(lat_bin+1,lat_bins-1)] += 1
			#for interpolation next iteration
			last_observation = observation

def WriteHeatmapAsKML(filepath, heatmap, min_lon, min_lat, lon_bin_size, lat_bin_size):
	with open(filepath, 'w') as fh:
		fh.write('<kml>\n')
		fh.write('\t<Document>\n')
		fh.write('\t\t<Folder>\n')
		
		for i in heatmap:
			for j in heatmap[i]:
				if(heatmap[i][j]>0):
					lon = (lon_bin_size / 2) + i*lon_bin_size + min_lon
					lat = (lat_bin_size / 2) + j*lat_bin_size + min_lat
					write_placemark([lon, lat], heatmap[i][j], fh) 
		
		fh.write('\t\t</Folder>\n')
		fh.write('\t</Document>\n')
		fh.write('</kml>\n')


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
		return None 

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

def PolygonIsClockwise(polygon):
	# http://stackoverflow.com/questions/1165647/how-to-determine-if-a-list-of-polygon-points-are-in-clockwise-order
	orientationsum = 0
	for i in range(len(polygon)):
		j = i+1 if (i < len(polygon) - 1) else 0
		orientationsum += (polygon[j][0]-polygon[i][0]) * (polygon[j][1]-polygon[i][1]) 
	return orientationsum > 0

def FindContourLoop(contours):	
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

pickle_name = 'heatmap.pkl'
heatmap_exists = os.path.isfile(pickle_name) 
if(heatmap_exists):
	with open(pickle_name, 'rb') as fh:
		[normalized_heatmap, min_lon, max_lon, min_lat, max_lat, lon_bins, lat_bins] = pickle.load(fh)		
	lon_bin_size = (max_lon - min_lon) / lon_bins
	lat_bin_size = (max_lat - min_lat) / lat_bins
else:
	print('Reading by gull')
	gull_data, min_lon, max_lon, min_lat, max_lat= read_data_by_gull('lesser_black_gulls.txt')#L909887  lesser_black_gulls

	print('Allocating heatmap')
	lon_bins = 20 * 10#00
	lat_bins = 20 * 20#00
	heatmap_bins = defaultdict(lambda : defaultdict(int))
	lon_bin_size = (max_lon - min_lon) / lon_bins
	lat_bin_size = (max_lat - min_lat) / lat_bins
	FillHeatmap(gull_data, heatmap_bins)

	print('Determining bin values')
	values = [heatmap_bins[i][j] for i in heatmap_bins for j in heatmap_bins[i]]
	#print(len(values))
	values.sort()
	"""
	bin_boundaries = [int(math.ceil((i/nr_value_bins)*len(values))-1) for i in range(1,nr_value_bins+1)]
	print(bin_boundaries)
	bin_values = [values[b] for b in bin_boundaries]
	print(bin_values)
	"""
	bin_values= []
	nr_value_bins = 5.0
	length_remaining = len(values)
	bins_remaining = nr_value_bins
	next_bin_boundary = math.ceil(length_remaining/ bins_remaining) - 1
	print("Bins remaining: %i,length_remaining: %i, next_bin_boundary: %i"%(bins_remaining, length_remaining, next_bin_boundary))
	for i in range(1, len(values)):
		if(i >= next_bin_boundary and values[i] != values[i-1] and values[i]>4):
			bin_values.append(values[i-1])
			length_remaining = len(values) - i
			bins_remaining -= 1

			if(bins_remaining == 0):
				break;

			next_bin_boundary = (i-1) + math.ceil(length_remaining / bins_remaining) - 1
			print("Bins remaining: %i,length_remaining: %i, next_bin_boundary: %i"%(bins_remaining, length_remaining, next_bin_boundary))

	normalized_heatmap = normalize_heatmap(heatmap_bins, bin_values, lon_bins, lat_bins)
	del heatmap_bins	
	with open(pickle_name, 'wb') as fh:
		pickle.dump([normalized_heatmap, min_lon, max_lon, min_lat, max_lat, lon_bins, lat_bins], fh)

#for i in range(1, len(bin_values)):
contours = find_contours(normalized_heatmap, 5.0)
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
		print("starts at (%3f, %3f) ends at (%3f, %3f)"%(contour[0][0],contour[0][1],contour[len(contour)-1][0],contour[len(contour)-1][1]))
		print("%r, %r, %r"%(startDiffersFromEnd, startAtBorder, endAtBorder))
		nonclosed.append(contour)
	else:
		# contours will wind counter-clockwise (i.e. in positive orientation) around islands of low-valued pixels.
		#if(PolygonIsClockwise(contour)):
		#	exteriors.append([contour])
		#else:
		#	interiors.append(contour)
		closed.append(contour)

def DeleteFromList(lst, indices):
	indices.sort()
	indices.reverse()
	for idx in indices:
		del lst[idx]


contour_loop, used_contours =  FindContourLoop(nonclosed)
while(contour_loop is not None):
	DeleteFromList(nonclosed, used_contours)
	#if(PolygonIsClockwise(contour)):
	#	exteriors.append([np.concatenate(contour_loop)])
	#else:
	#	interiors.append(np.concatenate(contour_loop))
	closed.append(np.concatenate(contour_loop))
	if(len(nonclosed)>0):
		contour_loop, used_contours = FindContourLoop(nonclosed)
	else:
		break


# This tests only if we are sure that polygons don't intersect (which should be the case for contour lines)
# Hence, we only need to test if a point of the proposed interior is actually inside the exterior
def PolygonIsInsidePolygon(inside, outside):
	return points_in_poly(inside, outside)[0]

# Now for each interior polygon, determine of which exterior polygon they are interior.
# Because the number of big exterior polygons is small, and the size of interior polygons is also small
def FitInteriorPolygonsToExteriorPolygons(interiors, exteriors):
	for interior in interiors:
		k = 0
		for exterior in exteriors:
			if(PolygonIsInsidePolygon(interior, exterior[0])):
				print("Added an interior polygon to an exterior one.")
				exterior.append(interior)
				break


print("closed:%i"%(len(closed)))
#FitInteriorPolygonsToExteriorPolygons(interiors, exteriors)
polyorder = defaultdict(lambda : [])
outermost = [True]*len(closed)
for n, poly1 in enumerate(closed):
	for m, poly2 in enumerate(closed):
		if(n!=m and all(points_in_poly(poly1, poly2))):
			polyorder[m].append(n)
			outermost[n] = False
			break

finalpolys = defaultdict(lambda:[])
def doOrdering(polyorder, toorder):
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
				ordering += doOrdering(polyorder, polyorder[innerfirst])
			ordering.append([first, secondlevel])
		return ordering

def WriteOrderingToFile(ordering, polygons):
	print('Writing to file')
	inProj = Proj(init='epsg:4326')
	outProj = Proj(init='epsg:3857')
	with open('gull_heatmap.js', 'w') as fh:
		fh.write('var contours = {\n')
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
				contour = closed[i]
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

print("Lens: %i, %i"%(len(polyorder),len(range(len(closed)))))
final_ordering = doOrdering(polyorder, range(len(closed)))
print(final_ordering)
WriteOrderingToFile(final_ordering, closed)
"""
finalpolys = defaultdict(lambda:[])
def doOrdering(polyorder, toorder):
#for key in polyorder:
#	if outermost[key]:
		innerpolys = polyorder[key]
		innerorder = [polyorder[m] for m in innerpolys]
		orderedList = sorted(innerpolys, key=lambda x: -len(innerorder[x]))

		immediateInterior = []
		filteredList = [n for n in orderedList]
		while(len(filteredList)>0):
			first = filteredList[0]
			immediateInterior.append(first)
			del filteredList[0]
			filteredList = [n for n in filteredList if n not in innerorder[first]]

sum1 = 0
for key, val in finalpolys.iter_items():
	sum1 += 1 + len(val)
print("closed:%i"%(len(closed)))
"""
#WriteContoursToFile('gull_heatmap.js', [exterior[0] for exterior in exteriors])


"""
print("Borders at (%3f, %3f) to (%3f, %3f)"%(0,0, lon_bins-1, lat_bins-1))
northending = []
for i in nonclosed:
	contour = contours[i]
	startDiffersFromEnd = (contour[len(contour)-1][0] != contour[0][0] or contour[len(contour)-1][1] != contour[0][1])
	startAtBorder = (contour[0][0] == 0 or contour[0][1] == 0 or contour[0][0] == lon_bins-1 or contour[0][1] == lat_bins-1)
	last = len(contour)-1
	endAtBorder = (contour[last][0] == 0 or contour[last][1] == 0 or contour[last][0] == lon_bins-1 or contour[last][1] == lat_bins-1)
	print("starts at (%3f, %3f) ends at (%3f, %3f)"%(contour[0][0],contour[0][1],contour[len(contour)-1][0],contour[len(contour)-1][1]))
	print("%r, %r, %r"%(startDiffersFromEnd, startAtBorder, endAtBorder))
	if(abs(contour[0][0]-min_lon)<0.5):
		print("%i begins north"%(i))
	if(abs(contour[0][1]-min_lat)<0.5):
		print("%i begins west"%(i))
	if(abs(contour[len(contour)-1][0]-min_lon)<0.5):
		print("%i ends north"%(i))
	if(abs(contour[len(contour)-1][1]-min_lat)<0.5):
		print("%i ends west"%(i))


	if(abs(contour[0][0]-max_lon)<0.5):
		print("%i begins south"%(i))
	if(abs(contour[0][1]-max_lat)<0.5):
		print("%i begins east"%(i))
	if(abs(contour[len(contour)-1][0]-max_lon)<0.5):
		print("%i ends south"%(i))
	if(abs(contour[len(contour)-1][1]-max_lat)<0.5):
		print("%i ends east"%(i))
		"""
"""
for i in range(len(nonclosed)):
	for j in range(i, len(nonclosed)):
		contour1begin = contours[i][0]
		contour1end = contours[i][len(contours[i])-1]
		contour2begin = contours[j][0]
		contour2end = contours[j][len(contours[j])-1]
		if(i!=j):
			if(abs(contour1begin[0] - contour2begin[0])<0.5):
				print("begin %i matched to begin %i based on lon"%(i,j))
			if(abs(contour1begin[1] - contour2begin[1])<0.5):
				print("begin %i matched to begin %i based on lat"%(i,j))
			if(abs(contour1end[0] - contour2end[0])<0.5):
				print("end %i matched to end %i based on lon"%(i,j))
			if(abs(contour1end[1] - contour2end[1])<0.5):
				print("end %i matched to end %i based on lat"%(i,j))
		if(abs(contour1end[0] - contour2begin[0])<0.5):
			print("end %i matched to begin %i based on lon"%(i,j))
		if(abs(contour1end[1] - contour2begin[1])<0.5):
			print("end %i matched to begin %i based on lat"%(i,j))
		if(abs(contour1begin[0] - contour2end[0])<0.5):
			print("begin %i matched to end %i based on lon"%(i,j))
		if(abs(contour1begin[1] - contour2end[1])<0.5):
			print("begin %i matched to end %i based on lat"%(i,j))
"""
"""
fig, ax = plt.subplots()
ax.imshow(normalized_heatmap.T*50, interpolation='nearest', cmap=plt.cm.gray)

for n, contour in enumerate(contours):
    ax.plot(contour[:, 0], contour[:, 1], linewidth=2)

ax.axis('image')
ax.set_xticks([])
ax.set_yticks([])
#plt.show()
"""
"""
{
  object: {
    'type': 'FeatureCollection',
    'crs': {
      'type': 'name',
      'properties': {
        'name': 'EPSG:3857'
      }
    },
    'features': [
      {
        'type': 'Feature',
        'geometry': {
          'type': 'Polygon',
          'coordinates': [[[-5e6, 6e6], [-5e6, 8e6], [-3e6, 8e6],
              [-3e6, 6e6], [-5e6, 6e6]]]
        }
      },
"""
