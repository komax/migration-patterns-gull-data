import os
import datetime

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