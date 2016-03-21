from flask import Flask, request, Response
from flask_restful import Resource, Api
from preprocess_contours import generate_contours_for_gulls

app = Flask(__name__)
api = Api(app)

todos = {}

class GenerateHeatmap(Resource):
    def get(self, gulls):
    	print('received')
    	print(gulls)
    	individuals = gulls.split('$')
        r = "jsonpContours(%s);"%(generate_contours_for_gulls(individuals))
    	#r = 'jsonpArrive({ "value" : "mystring"});'
        #return r, 200, {'Content-Type': 'application/javascript;'}
        return Response(r, content_type='application/javascript; charset=utf-8')

    def put(self, todo_id):
        todos[todo_id] = request.form['data']
        return {todo_id: todos[todo_id]}

api.add_resource(GenerateHeatmap, '/<string:gulls>')

if __name__ == '__main__':
    app.run(debug=True)