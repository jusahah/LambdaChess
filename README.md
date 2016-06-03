# LambdaChess

Chess position analysis on Amazon Lambda computation service. Works by splitting pgn game into positions and sending each position to AWS Lambda for analysis

Live demo can be found here: (http://139.162.187.101:8080/)

Uses Stockfish 7 as analysis engine. Note that AWS Lambda allows native executables be run so all analysis is done by native Stockfish, not the Javascript port. 
