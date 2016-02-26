import numpy as np
import math
import os
import datetime
from datetime import timedelta as timedelta
from collections import OrderedDict

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

print('Reading by gull')
gull_data, min_lon, max_lon, min_lat, max_lat= read_data_by_gull('lesser_black_gulls.txt')#L909887

print('Allocating heatmap')
lon_bins = 20 * 1000
lat_bins = 20 * 2000
heatmap_bins = np.zeros([lon_bins, lat_bins])
lon_bin_size = (max_lon - min_lon) / lon_bins
lat_bin_size = (max_lat - min_lat) / lat_bins

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
			
		# We want samples every 15 minutes, so we interpolate if needed.
		if(last_sample_time + timedelta(minutes=15) <= observation[2]):
			lon, lat = interpolate_position(last_observation, observation, last_sample_time + timedelta(minutes=15))
			last_sample_time = last_sample_time + timedelta(minutes=15)

		# If a sample is collected, add it to the heatmap.
		if(last_observation is None or (last_sample_time + timedelta(minutes=15) <= observation[2])):
			lat_bin = math.ceil((lat - min_lat)/lat_bin_size)-1
			lon_bin = math.ceil((lon - min_lon)/lon_bin_size)-1
			"""
			if(lon_bin == 199 and lat_bin>=78):
				print("Violator: Name, lon, lat, time")
				print(gull)
				print(observation[0])
				print(observation[1])
				print(observation[2])
				print(min_lon)
				print(max_lon)
				print(lon_bin)
				print(lon_bin_size)
				print(min_lat)
				print(max_lat)
				print(lat_bin)
				print(lat_bin_size)
			"""
			heatmap_bins[lon_bin, lat_bin] += 1
		#for interpolation next iteration
		last_observation = observation

print(heatmap_bins[199,78])
print(heatmap_bins[199,79])
print(heatmap_bins[199,80])
print(np.amax(heatmap_bins))
normalized_heatmap = heatmap_bins# np.log10(heatmap_bins) / np.amax(np.log10(heatmap_bins))
#normalized_heatmap[normalized_heatmap == float('-inf')] = 0
#del heatmap_bins
print(normalized_heatmap[199,78])
print(normalized_heatmap[199,79])
print(normalized_heatmap[199,80])

print('Writing to file')
with open('gull_heatmap.kml', 'w') as fh:
	fh.write('<kml>\n')
	fh.write('\t<Document>\n')
	fh.write('\t\t<Folder>\n')
	
	for i in range(lon_bins):
		for j in range(lat_bins):
			if(normalized_heatmap[i,j]>0):
				lon = (lon_bin_size / 2) + i*lon_bin_size + min_lon
				lat = (lat_bin_size / 2) + j*lat_bin_size + min_lat
				#if(lat<30 and lon > 0 and normalized_heatmap[i,j]>0):
				#	print("(%f,%f):(%i, %i):%f"%(lon, lat, i,j,normalized_heatmap[i,j]))
				write_placemark([lon, lat], normalized_heatmap[i,j], fh)
	
	fh.write('\t\t</Folder>\n')
	fh.write('\t</Document>\n')
	fh.write('</kml>\n')