gull_id = 'L909887'
gull_detected = False
with open('lesser_black_gulls.txt', 'r') as fi:
	with open(gull_id+'.txt', 'w') as fo:
		fi.readline() # first line is column info
		while(not gull_detected):
			line = fi.readline()
			while(gull_id in line):
				fo.write(line)
				line = fi.readline()
				gull_detected = True
