require(["d3"],function(d3){
  
  //Opacity: last activity
  //line width: request count
  
  var hostMapping = {};
  var hosts = [];
  var edges = {};
  var maxSize = 0;
  
  
  function addHost(addr,message){
    if(!(addr in hostMapping)){
      hostMapping[addr] = {
        index: hosts.length
      };
      hosts.push({
        name: addr,
        size: 0,
        sourceCount: 0,
        targetCount: 0,
        timestamp: 0
      });
    }
    var host = hostMapping[addr];
    var data = hosts[host.index];
    data.size += message.contentLength;
    maxSize = Math.max(maxSize, data.size);
    data.timestamp = Math.max(data.timestamp, message.timestamp_end);
    //data.flows.push(flow);
    return host.index;
  }
  
  traffic.each(function(flow){
    var source = flow.request.client_conn.address[0];
    var target = flow.request.host;
    var edgeName = source + "-" + target;
    
    var sourceIndex = addHost(source,flow.request);
    hosts[sourceIndex].sourceCount++;
    var targetIndex = addHost(target,flow.response);
    hosts[targetIndex].targetCount++;
    
    if(!(edgeName in edges)){
      edges[edgeName] = {
        requestCount : 0,
        source: sourceIndex,
        target: targetIndex
      };
    }
    var edge = edges[edgeName];
    edge.requestCount++;
    
  });
  
  edges = _.values(edges);
  
  var minTime, //We cannot calculate minTime before because we never know whether a timestamp is a latest timestamp
      maxTime;
  
  _.each(hosts,function(host){
    minTime = Math.min(minTime || Number.POSITIVE_INFINITY,host.timestamp);
    maxTime = Math.max(maxTime || Number.NEGATIVE_INFINITY,host.timestamp);
  });
  
  //console.debug(hostMapping,hosts,edges);
  
  // ----
  
  width = Math.max( $(outNode).width() * 0.85, 480 );  //width
  height = Math.max( $(outNode).height() * 0.85, 300 ); //height
  
  var radiusScale = 
      d3.scale.log()
  .domain([1, maxSize])
  .range([3, 10]);
  var opacityScale = 
      d3.scale.linear()
  .domain([minTime,maxTime])
  .range([0.5,1]);
  
  //console.log(minTime,maxTime);
  
  var svg = d3
  .select(outNode)
  .append("svg")
  .attr("height", height)
  .attr("width", width);
  
  var force = d3.layout.force()
  .charge(-100)
  .linkDistance(50)
  .size([width, height]);
  
  force
  .nodes(hosts)
  .links(edges)
  .start();
  
  var link = svg.selectAll(".link")
  .data(edges)
  .enter().append("line")
  .attr("class", "link")
  .style("stroke-width", function(d) { return Math.log(d.requestCount+1); })
  .attr("stroke", "#999");
  
  var node = svg.selectAll(".node")
  .data(hosts)
  .enter().append("image")
  .attr("width",16).attr("height",16)
  .attr("xlink:href",function(d){
    return "http://"+d.name+"/favicon.ico";
  })
  .style("opacity",function(d) { return opacityScale(d.timestamp); })
  .call(force.drag);
  
  node.append("title")
  .text(function(d) { return d.name; });
  
  force.on("tick", function() {
    link.attr("x1", function(d) { return d.source.x; })
    .attr("y1", function(d) { return d.source.y; })
    .attr("x2", function(d) { return d.target.x; })
    .attr("y2", function(d) { return d.target.y; });
    
    node.attr("x", function(d) { return d.x; })
    .attr("y", function(d) { return d.y; });
  });
  
});