import numpy as np
import math
import os
import datetime
from datetime import timedelta as timedelta
from collections import OrderedDict, defaultdict
import matplotlib.pyplot as plt
import pickle
from gull_data_loader import read_data_by_gull

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

def interpolate_position(ob1, ob2, time):
	sec_per_day = 24*60*60
	seconds_between_obs = (ob2[2] - ob1[2]).days*sec_per_day + (ob2[2] - ob1[2]).seconds
	seconds_between_ob_time = (time - ob1[2]) .days*sec_per_day + (time - ob1[2]).seconds
	alpha = seconds_between_ob_time/ seconds_between_obs
	inter_lon = ob1[0] + (ob2[0] - ob2[0])* alpha
	inter_lat = ob1[1] + (ob2[1] - ob2[1])* alpha
	return inter_lon, inter_lat

def FillHeatmap(gull_data, heatmap, min_lon, min_lat, lon_bin_size, lat_bin_size, lon_bins, lat_bins, sampletime =15):
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


def generate_heatmap(filein, fileout, nrlonbins = 200, nrlatbins = 400):
	gull_data, min_lon, max_lon, min_lat, max_lat = read_data_by_gull(filein)

	heatmap_bins = defaultdict(lambda : defaultdict(int))
	lon_bins = nrlonbins
	lat_bins = nrlatbins
	lon_bin_size = (max_lon - min_lon) / lon_bins
	lat_bin_size = (max_lat - min_lat) / lat_bins
	FillHeatmap(gull_data, heatmap_bins, min_lon, min_lat, lon_bin_size, lat_bin_size, lon_bins, lat_bins)

	# We discretize the heatmap values to nr_value_bins different bins.
	values = [heatmap_bins[i][j] for i in heatmap_bins for j in heatmap_bins[i]]
	values.sort()
	bin_values= []
	nr_value_bins = 5.0
	length_remaining = len(values)
	bins_remaining = nr_value_bins
	next_bin_boundary = math.ceil(length_remaining/ bins_remaining) - 1
	for i in range(1, len(values)):
		if(i >= next_bin_boundary and values[i] != values[i-1] and values[i]>4):
			bin_values.append(values[i-1])
			length_remaining = len(values) - i
			bins_remaining -= 1

			if(bins_remaining == 0):
				break;

			next_bin_boundary = (i-1) + math.ceil(length_remaining / bins_remaining) - 1

	normalized_heatmap = normalize_heatmap(heatmap_bins, bin_values, lon_bins, lat_bins)
	del heatmap_bins	

	with open(fileout, 'wb') as fh:
		pickle.dump([normalized_heatmap, min_lon, max_lon, min_lat, max_lat, lon_bins, lat_bins], fh)


