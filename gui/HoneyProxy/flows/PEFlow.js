/**
 * Flow subclass responsible for proper display of PE files
 */
define([
    "dojo/_base/declare",
	"dojo/Deferred",
	"../util/_DynamicTemplatedWidget",
    "../models/Flow",
    "dojo/text!./templates/pe.ejs"
],function(declare,Deferred,_DynamicTemplatedWidget,Flow,template){
	
	var MACHINES = {
	  0x014c: "x86", 
	  0x0200: "Intel Itanium", 
	  0x8664: "x64"};
	var SECTION_FLAGS = {
	  0x00000020: "code", 
	  0x00000040: "data",
	  0x00000080: "uninitialized",
	  0x20000000: "execute",
	  0x40000000: "read",
	  0x80000000: "write"}
	
	var PEPreview = declare([_DynamicTemplatedWidget], {
		templateString: template,
		postCreate: function(){
			this.inherited(arguments);
			/* First, get the DOS Header */
			this.model.response.getContent({range:"bytes=0-63",responseType:"arraybuffer"}).then((function(dosHeader){
			  var dosHeader = new DataView(dosHeader);
			  var dosMagic = dosHeader.getUint16(0);
			  var ntOffset = dosHeader.getUint16(60,true);
			  //Verify that the correct DOS signature is in place
			  var signatureValid = (dosMagic === 0x4d5a /* MZ */);
			  if(signatureValid)
			  {
			    //get the PE header and the first part of the optional header
			    var ntHeaderRange = "bytes="+ (ntOffset) +"-" + (ntOffset+0x77);
			    this.model.response.getContent({range:ntHeaderRange ,responseType:"arraybuffer"}).then((function(_ntHeaders){
			      var ntHeaders      = new DataView(_ntHeaders,0,4),
			          peHeader       = new DataView(_ntHeaders,4,20),
			          optionalHeader = new DataView(_ntHeaders,24);
			      
			      //Check if the file has a valid PE signature    
			      var signatureValid = (ntHeaders.getUint32(0) === 0x50450000 // PE\0\0
			                           && optionalHeader.getUint16(0) === 0x0b01);
			          
			      if(signatureValid){
			        
			        //Display machine type
			        var machine = peHeader.getUint16(0,true);
			        if(machine in MACHINES)
			          machine = MACHINES[machine];
			        else
			          machine = "0x"+machine.toString(16);
			        this.machineNode.innerHTML = machine;
			        
			        //Display section table
			        var sectionTableStart = ntOffset + 0x18 + peHeader.getUint16(0x10,true);
			        var sectionTableRange = "bytes=" + sectionTableStart  +"-" + (sectionTableStart+ (0x28*peHeader.getUint16(0x02,true)) -1);
			        
			        this.model.response.getContent({range:sectionTableRange ,responseType:"arraybuffer"}).then((function(_sectionTable){
			          var sectionTable = new DataView(_sectionTable);
			          
			          var sections = [];
			          
			          for(var i=0;i<sectionTable.byteLength;i+=0x28){
			            var section = {};
			            section.name = ''; //The name is a 8-byte, null-padded UTF-8 string. So much fun to parse in JS.
			            //http://msdn.microsoft.com/en-us/library/windows/desktop/ms680341(v=vs.85).aspx
			            for(var j=0;j<8;j++) {
			              section.name += '%' + ('0' + sectionTable.getUint8(i+j).toString(16)).slice(-2);
			            }
			            section.name = decodeURIComponent(section.name); // http://stackoverflow.com/questions/14028148/convert-integer-array-to-string-at-javascript
			            section.vsize = "0x"+sectionTable.getUint32(i+0x08, true).toString(16),
			            section.vaddr = "0x"+sectionTable.getUint32(i+0x0c, true).toString(16),
			            section.rsize = "0x"+sectionTable.getUint32(i+0x10, true).toString(16),
			            section.raddr = "0x"+sectionTable.getUint32(i+0x14, true).toString(16),
			            section.flags = "0x"+sectionTable.getUint32(i+0x24, true).toString(16);
			            section.characteristics = [];
			            for(f in SECTION_FLAGS){
			              if((section.flags & f) !== 0)
			                section.characteristics.push(SECTION_FLAGS[f]);
			            }
			            sections.push(section)
			          }
			          
			          
			          this.sectionsNode.innerHTML = '<pre style="margin:0">' + 
			            sections.map(function(s){
			              return s.name 
			                + "\n\tFlags: "+s.flags + "("+s.characteristics.join(" ")+")"
			                + "\n\tVirtualSize: "+s.vsize
			                + "\n\tVirtualAddress: "+s.vaddr
			                + "\n\tSizeOfRawData: "+s.rsize
			                + "\n\tPointerToRawData: "+s.raddr;
			              }).join("\n") +
			              "</pre>";
			              
			          //console.debug(sections);
			          //int8 = new Uint8Array(_sectionTable)
			          //console.log("\n"+Array.prototype.map.call(int8,function(x){return ("0"+x.toString(16)).substr(-2)}).join(" "));
			        }).bind(this));
			      }
			    }).bind(this));
			  }
			  if(!signatureValid){
			    this.sectionsNode.innerHTML = "<b>Invalid File Signature</b>";
			  }			  
			}).bind(this));
		}
	});
	
	return Flow.extend({
		getPreview : function() {
			var preview = new PEPreview({
				model:this
			});
			return (new Deferred()).resolve(preview.domNode);
		}
	}, {
		matches : function(data) {
			if (data.contentType)
				if(!!data.contentType.match(/application\/(x-msdownload|x-msdos-program|exe|x-exe|dos-exe|x-winexe|msdos-windows)/i))
				  return true;
			else if (data.path)
				return !!data.path.match(/\.(exe|dll|sys|drv|com)$/i);
			return false;
		},
		getCategory : function() {
			return "executable";
		}
	});
});