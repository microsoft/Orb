//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------
// Custom Edgejs integration for PowerShell
//

using System.Management.Automation.Host;

namespace Orb
{

    using System;

    public class PSEdgeRawUI : PSHostRawUserInterface
    {
        private Size _maxPhysicalWindowSize;
        private Size _maxWindowSize;

        public PSEdgeRawUI()
        {
            // These defaults are copied from $host.UI.RawUI from a PS session.
            this.BackgroundColor = ConsoleColor.DarkBlue;
            this.BufferSize = new Size(150,9001);
            this.CursorPosition = new Coordinates(0,38);
            this.CursorSize = 25;
            this.WindowSize = new Size(150,30);
            this._maxWindowSize = new Size(150,52);
            this._maxPhysicalWindowSize = new Size(200,52);
            this.WindowTitle = "OrbPs";
        }

        public override KeyInfo ReadKey(ReadKeyOptions options)
        {
            //Console.WriteLine("Readkey");
            throw new NotImplementedException();
        }

        public override void FlushInputBuffer()
        {
            //Console.WriteLine("Flush");
            throw new NotImplementedException();
        }

        public override void SetBufferContents(Coordinates origin, BufferCell[,] contents)
        {
            //Console.WriteLine("SetBuffer");
            throw new NotImplementedException();
        }

        public override void SetBufferContents(Rectangle rectangle, BufferCell fill)
        {
            //Console.WriteLine("SetBuffer fill");
            throw new NotImplementedException();
        }

        public override BufferCell[,] GetBufferContents(Rectangle rectangle)
        {
            //Console.WriteLine("GetBuffer");
            throw new NotImplementedException();
        }

        public override void ScrollBufferContents(Rectangle source, Coordinates destination, Rectangle clip, BufferCell fill)
        {
            //Console.WriteLine("ScrollBuffer");
            throw new NotImplementedException();
        }

        public override ConsoleColor BackgroundColor { get; set; }
        public override Size BufferSize { get; set; }
        public override Coordinates CursorPosition { get; set; }
        public override int CursorSize { get; set; }
        public override ConsoleColor ForegroundColor { get; set; }


        public override bool KeyAvailable
        {
            get
            {
                //Console.WriteLine("KeyAvailable");
                return false;
            }
        }

        public override Size MaxPhysicalWindowSize
        {
            get { return _maxPhysicalWindowSize; }
        }

        public override Size MaxWindowSize
        {
            get { return _maxWindowSize; }
        }


        public override Coordinates WindowPosition { get; set; }
        public override Size WindowSize { get; set; }
        public override string WindowTitle { get; set; }
    }

}
