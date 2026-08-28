const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `                    } catch(err) {
                        console.error('Error placing auto buy order:', err);
                    }
                }
             }
          }
       }
    }
    
  } catch (err)  {
     console.error('Bot loop error:', err);
  }
}, 5000);`;

const replaceStr = `                    } catch(err) {
                        console.error('Error placing auto buy order:', err);
                    }
                }
             }
          }
       } catch (innerErr) {
          console.error("Inner loop err for", idx.key, innerErr);
       }
       }
    }
    
  } catch (err)  {
     console.error('Bot loop error:', err);
  }
}, 5000);`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('server.ts', code);
console.log("Patched server bot loop part 2");
